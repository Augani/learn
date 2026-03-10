# Lesson 07: Data Modeling

## The Library Catalog Analogy

A library doesn't just pile books on the floor. It organizes them so
you can find anything fast: by subject, author, or title.

Data modeling does the same for your data warehouse.

```
  UNMODELED DATA (pile of books)     MODELED DATA (organized library)
  +---------------------------+      +---------------------------+
  | orders_raw                |      | fact_orders               |
  | - user_name               |      | - order_id (FK)           |
  | - user_email              |      | - user_key (FK)           |
  | - user_address            |      | - product_key (FK)        |
  | - product_name            |      | - date_key (FK)           |
  | - product_category        |      | - quantity                |
  | - order_date              |      | - amount                  |
  | - order_amount            |      +---------------------------+
  | - shipping_address        |
  | (everything in one table) |      dim_users    dim_products
  +---------------------------+      dim_dates    dim_geography
  Redundant, slow, messy             Clean, fast, reusable
```

---

## Dimensional Modeling

Ralph Kimball's approach: organize data around business processes
(facts) and the context around them (dimensions).

```
  FACT TABLE = What happened (measurements, events, transactions)
  DIMENSION TABLE = Context about what happened (who, what, when, where)

  Think of a sentence:
  "Alice bought 3 widgets on March 1st in New York for $45"

  +--------+     +--------+     +--------+     +--------+
  | WHO    |     | WHAT   |     | WHEN   |     | WHERE  |
  | Alice  |     | Widget |     | Mar 1  |     | NYC    |
  +---+----+     +---+----+     +---+----+     +---+----+
      |              |              |              |
      +--------------+--------------+--------------+
                     |
               +-----+------+
               | FACT       |
               | qty: 3     |  (the measurement)
               | amount: 45 |
               +------------+
```

---

## Star Schema

The most common dimensional model. One fact table in the center,
dimension tables radiating out like a star.

```
                    +-------------+
                    | dim_date    |
                    | date_key    |
                    | full_date   |
                    | day_of_week |
                    | month       |
                    | quarter     |
                    | year        |
                    | is_holiday  |
                    +------+------+
                           |
  +-------------+    +-----+-------+    +-------------+
  | dim_user    |    | fact_orders |    | dim_product  |
  | user_key    +----+ order_id    +----+ product_key  |
  | user_id     |    | user_key    |    | product_id   |
  | name        |    | product_key |    | name         |
  | email       |    | date_key    |    | category     |
  | segment     |    | geo_key     |    | subcategory  |
  | signup_date |    | quantity    |    | brand        |
  | lifetime_val|    | unit_price  |    | price_tier   |
  +-------------+    | total_amount|    +-------------+
                     | discount    |
                     +------+------+
                            |
                    +-------+-------+
                    | dim_geography |
                    | geo_key       |
                    | city          |
                    | state         |
                    | country       |
                    | region        |
                    +---------------+
```

### Building a Star Schema in SQL

```sql
CREATE TABLE dim_date (
    date_key INTEGER PRIMARY KEY,
    full_date DATE NOT NULL,
    day_of_week VARCHAR(10),
    day_of_month INTEGER,
    month INTEGER,
    month_name VARCHAR(10),
    quarter INTEGER,
    year INTEGER,
    is_weekend BOOLEAN,
    is_holiday BOOLEAN
);

CREATE TABLE dim_user (
    user_key INTEGER PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    name VARCHAR(200),
    email VARCHAR(200),
    segment VARCHAR(50),
    signup_date DATE,
    city VARCHAR(100),
    country VARCHAR(100),
    effective_from DATE,
    effective_to DATE,
    is_current BOOLEAN DEFAULT TRUE
);

CREATE TABLE dim_product (
    product_key INTEGER PRIMARY KEY,
    product_id VARCHAR(50) NOT NULL,
    name VARCHAR(200),
    category VARCHAR(100),
    subcategory VARCHAR(100),
    brand VARCHAR(100),
    price_tier VARCHAR(20)
);

CREATE TABLE fact_orders (
    order_id VARCHAR(50) PRIMARY KEY,
    user_key INTEGER REFERENCES dim_user(user_key),
    product_key INTEGER REFERENCES dim_product(product_key),
    date_key INTEGER REFERENCES dim_date(date_key),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10, 2),
    total_amount DECIMAL(10, 2),
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    shipping_cost DECIMAL(10, 2) DEFAULT 0
);
```

### Populating the Date Dimension

```python
import pandas as pd
from sqlalchemy import create_engine

start = pd.Timestamp("2020-01-01")
end = pd.Timestamp("2030-12-31")
dates = pd.date_range(start, end, freq="D")

dim_date = pd.DataFrame({
    "date_key": [int(d.strftime("%Y%m%d")) for d in dates],
    "full_date": dates,
    "day_of_week": [d.strftime("%A") for d in dates],
    "day_of_month": [d.day for d in dates],
    "month": [d.month for d in dates],
    "month_name": [d.strftime("%B") for d in dates],
    "quarter": [d.quarter for d in dates],
    "year": [d.year for d in dates],
    "is_weekend": [d.weekday() >= 5 for d in dates],
    "is_holiday": [False] * len(dates)
})

engine = create_engine("postgresql://localhost:5432/warehouse")
dim_date.to_sql("dim_date", engine, if_exists="replace", index=False)
```

---

## Snowflake Schema

Like a star schema, but dimensions are normalized further. Named
because it looks like a snowflake when drawn.

```
  STAR:                          SNOWFLAKE:
  +------+   +------+           +------+   +------+   +------+
  | dim  |---| fact |           | sub  |---| dim  |---| fact |
  +------+   +------+           | dim  |   +------+   +------+
                                +------+
  Denormalized dimensions        Normalized dimensions
  Simpler queries                Less redundancy
  More storage                   More joins
```

```
  Star: dim_product has category, subcategory, brand all in one table
  Snowflake: dim_product -> dim_category -> dim_subcategory (separate tables)

  +----------+    +-------------+    +----------------+
  | dim_brand|--->| dim_product |--->| fact_orders    |
  +----------+    +------+------+    +----------------+
                         |
                  +------+--------+
                  | dim_category  |
                  +------+--------+
                         |
                  +------+--------+
                  | dim_subcategory|
                  +---------------+
```

**Use star schema unless you have a specific reason for snowflake.**
The extra joins rarely justify the space savings.

---

## Fact Table Types

```
  TRANSACTION FACTS              PERIODIC SNAPSHOT              ACCUMULATING SNAPSHOT
  +---+---+---+---+              +-------+-------+              +-------+-------+
  | E | E | E | E |              | Day 1 | Day 2 |              |Start |Middle| End |
  | v | v | v | v |              | snap  | snap  |              |      |      |     |
  | e | e | e | e |              +-------+-------+              +------+------+-----+
  | n | n | n | n |
  | t | t | t | t |              Daily/weekly balance           Tracks lifecycle
  +---+---+---+---+              of an account                  of a process
  One row per event              One row per entity              One row per entity
                                 per period                      updated as it progresses
```

```sql
-- Transaction fact: one row per order
CREATE TABLE fact_orders (
    order_id VARCHAR(50),
    date_key INTEGER,
    user_key INTEGER,
    amount DECIMAL(10,2)
);

-- Periodic snapshot: daily balance per user
CREATE TABLE fact_daily_balance (
    date_key INTEGER,
    user_key INTEGER,
    account_balance DECIMAL(10,2),
    orders_count INTEGER,
    cumulative_spend DECIMAL(10,2)
);

-- Accumulating snapshot: order lifecycle
CREATE TABLE fact_order_lifecycle (
    order_id VARCHAR(50),
    created_date_key INTEGER,
    shipped_date_key INTEGER,
    delivered_date_key INTEGER,
    returned_date_key INTEGER,
    current_status VARCHAR(20),
    amount DECIMAL(10,2)
);
```

---

## Slowly Changing Dimensions (SCD)

When dimension data changes over time. Like a customer moving cities.

```
  SCD Type 1: Overwrite (lose history)
  Before: Alice | NYC       After: Alice | LA
  Simple but you lose the fact she was in NYC

  SCD Type 2: Add new row (keep history)
  +-------+------+-----+------------+------------+---------+
  | key   | name | city| eff_from   | eff_to     | current |
  +-------+------+-----+------------+------------+---------+
  | 1001  | Alice| NYC | 2023-01-01 | 2024-06-15 | false   |
  | 1002  | Alice| LA  | 2024-06-15 | 9999-12-31 | true    |
  +-------+------+-----+------------+------------+---------+
  Two rows for Alice, each valid for a time range

  SCD Type 3: Add column (limited history)
  +-------+------+----------+---------+
  | key   | name | city     | prev_city|
  +-------+------+----------+---------+
  | 1001  | Alice| LA       | NYC     |
  +-------+------+----------+---------+
  Only tracks one previous value
```

### SCD Type 2 Implementation

```sql
WITH new_data AS (
    SELECT
        user_id,
        name,
        city,
        CURRENT_DATE AS load_date
    FROM staging_users
),

changed AS (
    SELECT n.*
    FROM new_data n
    JOIN dim_user d ON n.user_id = d.user_id AND d.is_current = TRUE
    WHERE n.name != d.name OR n.city != d.city
)

UPDATE dim_user
SET
    effective_to = CURRENT_DATE,
    is_current = FALSE
WHERE user_id IN (SELECT user_id FROM changed)
AND is_current = TRUE;

INSERT INTO dim_user (user_key, user_id, name, city, effective_from, effective_to, is_current)
SELECT
    nextval('dim_user_seq'),
    user_id,
    name,
    city,
    CURRENT_DATE,
    '9999-12-31',
    TRUE
FROM changed;
```

---

## Modeling for ML

ML needs data shaped differently than BI dashboards:

```
  BI QUERY:                        ML FEATURE TABLE:
  "Revenue by segment              "For user X, what are their
   last quarter"                    features at prediction time?"

  +--------+---------+             +--------+--------+--------+
  | segment| revenue |             | user_id| feat_1 | feat_2 |
  +--------+---------+             +--------+--------+--------+
  | Premium| $500K   |             | 1      | 0.85   | 12     |
  | Free   | $50K    |             | 2      | 0.23   | 3      |
  +--------+---------+             +--------+--------+--------+
  Aggregated, few rows             Per-entity, many columns
```

```sql
CREATE TABLE ml_user_features AS
SELECT
    u.user_key,
    u.user_id,
    u.segment,
    u.signup_date,
    CURRENT_DATE - u.signup_date AS account_age_days,
    COALESCE(o.total_orders, 0) AS total_orders,
    COALESCE(o.total_spend, 0) AS total_spend,
    COALESCE(o.avg_order_value, 0) AS avg_order_value,
    COALESCE(o.days_since_last_order, 999) AS days_since_last_order,
    COALESCE(o.order_frequency, 0) AS order_frequency
FROM dim_user u
LEFT JOIN (
    SELECT
        user_key,
        COUNT(*) AS total_orders,
        SUM(total_amount) AS total_spend,
        AVG(total_amount) AS avg_order_value,
        CURRENT_DATE - MAX(d.full_date) AS days_since_last_order,
        COUNT(*) * 1.0 / NULLIF(
            CURRENT_DATE - MIN(d.full_date), 0
        ) AS order_frequency
    FROM fact_orders f
    JOIN dim_date d ON f.date_key = d.date_key
    GROUP BY user_key
) o ON u.user_key = o.user_key
WHERE u.is_current = TRUE;
```

---

## Common Anti-Patterns

```
  +---------------------------+--------------------------------+
  | Anti-Pattern              | Why It's Bad                   |
  +---------------------------+--------------------------------+
  | One giant flat table      | Redundant data, update anomalies|
  +---------------------------+--------------------------------+
  | Too many joins            | Snowflake overkill, slow queries|
  | (over-normalized)         |                                |
  +---------------------------+--------------------------------+
  | No date dimension         | Can't do calendar-aware queries|
  +---------------------------+--------------------------------+
  | Natural keys as FKs       | Break when source systems change|
  +---------------------------+--------------------------------+
  | No SCD strategy           | Lose history, wrong analytics  |
  +---------------------------+--------------------------------+
  | Mixing fact grain         | Aggregation errors, double     |
  |                           | counting                       |
  +---------------------------+--------------------------------+
```

---

## Exercises

1. **Design a star schema**: For a ride-sharing company, design a star
   schema with fact_rides and appropriate dimensions. Include at least
   4 dimension tables. Write the CREATE TABLE statements.

2. **Build a date dimension**: Generate a date dimension table covering
   2020-2030 with: holidays for your country, fiscal quarters, week
   numbers, and is_business_day flags.

3. **SCD Type 2**: Implement a full SCD Type 2 pipeline for a customer
   dimension. Start with 100 customers, simulate 20 address changes,
   and verify the history is maintained correctly.

4. **Feature table**: From your star schema, create an ML feature table
   that computes at least 10 features per user including recency,
   frequency, monetary value, and behavioral metrics.

5. **Schema migration**: You have a flat denormalized table with 50
   columns. Normalize it into a star schema. Write the migration SQL
   that populates the new tables from the old one.

---

[Next: Lesson 08 - dbt ->](08-dbt.md)
