# Lesson 08: dbt (Data Build Tool)

## Software Engineering for SQL

dbt treats your SQL transformations like software: version controlled,
tested, documented, and built in dependency order.

Think of it like going from writing scripts in a notebook to building
a proper application:

```
  WITHOUT dbt:                    WITH dbt:
  +------------------+            +------------------+
  | random_query.sql |            | models/          |
  | final_v2.sql     |            |   staging/       |
  | FINAL_FINAL.sql  |            |     stg_orders.sql
  | copy_of_final.sql|            |   marts/         |
  |                  |            |     fct_orders.sql|
  | Who runs what?   |            |   metrics/       |
  | In what order?   |            |     revenue.sql  |
  | Does it work?    |            | tests/           |
  +------------------+            | docs/            |
  Chaos                           +------------------+
                                  Order
```

---

## How dbt Works

```
  +----------+     +----------+     +----------+
  | Raw Data |     |   dbt    |     | Curated  |
  | (loaded  | --> | (SELECT  | --> | Tables & |
  |  by EL)  |     |  only)   |     |  Views   |
  +----------+     +----------+     +----------+
                       |
                   dbt does NOT extract or load
                   dbt ONLY transforms (the T in ELT)
```

```
  dbt compiles SQL models and runs them in your warehouse:

  1. You write:  SELECT * FROM {{ ref('stg_orders') }} WHERE amount > 0
  2. dbt compiles: SELECT * FROM "analytics"."stg_orders" WHERE amount > 0
  3. dbt runs:   CREATE TABLE "analytics"."clean_orders" AS (compiled SQL)
```

---

## Project Structure

```
  my_dbt_project/
  |
  +-- dbt_project.yml          Project config
  +-- profiles.yml             Connection config
  |
  +-- models/
  |   +-- staging/             Raw -> cleaned
  |   |   +-- _stg_models.yml   Schema + docs
  |   |   +-- stg_orders.sql
  |   |   +-- stg_users.sql
  |   |   +-- stg_products.sql
  |   |
  |   +-- intermediate/       Business logic
  |   |   +-- int_order_items.sql
  |   |   +-- int_user_metrics.sql
  |   |
  |   +-- marts/               Final tables
  |       +-- finance/
  |       |   +-- fct_revenue.sql
  |       +-- marketing/
  |           +-- dim_customers.sql
  |
  +-- tests/                   Custom tests
  |   +-- assert_positive_revenue.sql
  |
  +-- macros/                  Reusable SQL
  |   +-- cents_to_dollars.sql
  |
  +-- seeds/                   Static CSV data
      +-- country_codes.csv
```

---

## Models

A model is a SELECT statement saved as a `.sql` file. dbt figures out
dependencies and runs them in the right order.

### Staging Models

Clean and rename raw data. One staging model per source table.

```sql
-- models/staging/stg_orders.sql

WITH source AS (
    SELECT * FROM {{ source('app_db', 'orders') }}
),

renamed AS (
    SELECT
        id AS order_id,
        user_id,
        product_id,
        CAST(created_at AS TIMESTAMP) AS ordered_at,
        CAST(amount_cents AS DECIMAL) / 100.0 AS amount,
        status,
        CAST(updated_at AS TIMESTAMP) AS updated_at
    FROM source
    WHERE id IS NOT NULL
)

SELECT * FROM renamed
```

### Intermediate Models

Combine and apply business logic:

```sql
-- models/intermediate/int_order_items.sql

WITH orders AS (
    SELECT * FROM {{ ref('stg_orders') }}
),

users AS (
    SELECT * FROM {{ ref('stg_users') }}
),

products AS (
    SELECT * FROM {{ ref('stg_products') }}
)

SELECT
    o.order_id,
    o.ordered_at,
    o.amount,
    o.status,
    u.user_id,
    u.name AS user_name,
    u.segment AS user_segment,
    p.product_id,
    p.name AS product_name,
    p.category AS product_category
FROM orders o
LEFT JOIN users u ON o.user_id = u.user_id
LEFT JOIN products p ON o.product_id = p.product_id
```

### Mart Models

Business-ready aggregations:

```sql
-- models/marts/finance/fct_revenue.sql

WITH order_items AS (
    SELECT * FROM {{ ref('int_order_items') }}
)

SELECT
    DATE_TRUNC('day', ordered_at) AS revenue_date,
    user_segment,
    product_category,
    COUNT(DISTINCT order_id) AS order_count,
    COUNT(DISTINCT user_id) AS unique_customers,
    SUM(amount) AS total_revenue,
    AVG(amount) AS avg_order_value
FROM order_items
WHERE status = 'completed'
GROUP BY 1, 2, 3
```

---

## The ref() Function and DAG

`ref()` creates dependencies. dbt builds a DAG (directed acyclic graph)
and runs models in the correct order.

```
  {{ ref('stg_orders') }}  tells dbt:
  1. This model depends on stg_orders
  2. Run stg_orders BEFORE this model
  3. Use the correct schema/table name

  DAG:
  stg_orders ---+
                |
  stg_users  ---+--> int_order_items --> fct_revenue
                |
  stg_products -+

  dbt runs: stg_* first (parallel), then int_*, then fct_*
```

---

## Sources

Define where raw data lives:

```yaml
# models/staging/_stg_models.yml

version: 2

sources:
  - name: app_db
    database: raw
    schema: public
    tables:
      - name: orders
        loaded_at_field: updated_at
        freshness:
          warn_after: {count: 12, period: hour}
          error_after: {count: 24, period: hour}
      - name: users
      - name: products
```

---

## Tests

### Built-in Tests

```yaml
# models/staging/_stg_models.yml

version: 2

models:
  - name: stg_orders
    columns:
      - name: order_id
        tests:
          - unique
          - not_null
      - name: amount
        tests:
          - not_null
      - name: status
        tests:
          - accepted_values:
              values: ['pending', 'completed', 'cancelled', 'refunded']
      - name: user_id
        tests:
          - not_null
          - relationships:
              to: ref('stg_users')
              field: user_id
```

### Custom Tests

```sql
-- tests/assert_positive_revenue.sql

SELECT
    revenue_date,
    total_revenue
FROM {{ ref('fct_revenue') }}
WHERE total_revenue < 0
```

If this query returns rows, the test fails.

### Generic Tests (Macros)

```sql
-- macros/test_is_positive.sql

{% test is_positive(model, column_name) %}

SELECT *
FROM {{ model }}
WHERE {{ column_name }} < 0

{% endtest %}
```

```yaml
models:
  - name: fct_revenue
    columns:
      - name: total_revenue
        tests:
          - is_positive
```

---

## Materializations

How dbt creates the model in your warehouse:

```
  +--------+---------------------------------------------------+
  | Type   | What It Does                                      |
  +--------+---------------------------------------------------+
  | view   | CREATE VIEW (no data stored, runs query each time)|
  | table  | CREATE TABLE AS SELECT (stores data, full refresh)|
  | increm | INSERT only new/changed rows (efficient for big)  |
  | ephem  | Not created in DB, inlined as CTE in parent model |
  +--------+---------------------------------------------------+
```

```
  Staging:        view or ephemeral  (small, referenced often)
  Intermediate:   ephemeral or view  (not queried directly)
  Marts:          table or incremental (queried by dashboards/ML)
```

### Incremental Models

```sql
-- models/marts/fct_daily_events.sql

{{
    config(
        materialized='incremental',
        unique_key='event_date || user_id',
        on_schema_change='append_new_columns'
    )
}}

WITH new_events AS (
    SELECT
        DATE(event_time) AS event_date,
        user_id,
        COUNT(*) AS event_count,
        SUM(amount) AS total_amount
    FROM {{ ref('stg_events') }}

    {% if is_incremental() %}
        WHERE event_time > (SELECT MAX(event_date) FROM {{ this }})
    {% endif %}

    GROUP BY 1, 2
)

SELECT * FROM new_events
```

---

## Macros and Jinja

dbt uses Jinja templating for DRY SQL:

```sql
-- macros/cents_to_dollars.sql

{% macro cents_to_dollars(column_name, precision=2) %}
    ROUND(CAST({{ column_name }} AS DECIMAL) / 100.0, {{ precision }})
{% endmacro %}
```

Use it in models:

```sql
SELECT
    order_id,
    {{ cents_to_dollars('amount_cents') }} AS amount,
    {{ cents_to_dollars('tax_cents') }} AS tax,
    {{ cents_to_dollars('shipping_cents', 4) }} AS shipping
FROM {{ source('app_db', 'orders') }}
```

### Useful Macro Patterns

```sql
-- macros/generate_surrogate_key.sql

{% macro surrogate_key(field_list) %}
    MD5(CONCAT_WS('|', {% for field in field_list %}
        COALESCE(CAST({{ field }} AS VARCHAR), '_null_')
        {% if not loop.last %}, {% endif %}
    {% endfor %}))
{% endmacro %}
```

---

## dbt Commands

```
  +----------------------------+----------------------------------+
  | Command                    | What It Does                     |
  +----------------------------+----------------------------------+
  | dbt run                    | Build all models                 |
  | dbt run --select stg_*     | Build only staging models        |
  | dbt run --select +fct_rev  | Build fct_revenue and all parents|
  | dbt test                   | Run all tests                    |
  | dbt test --select stg_*    | Test only staging models         |
  | dbt build                  | Run + test in dependency order   |
  | dbt docs generate          | Generate documentation site      |
  | dbt docs serve             | Serve docs locally               |
  | dbt source freshness       | Check source data freshness      |
  | dbt seed                   | Load CSV seeds into warehouse    |
  | dbt snapshot               | Capture SCD Type 2 changes       |
  +----------------------------+----------------------------------+
```

---

## Snapshots (SCD Type 2)

```sql
-- snapshots/users_snapshot.sql

{% snapshot users_snapshot %}

{{
    config(
        target_schema='snapshots',
        unique_key='user_id',
        strategy='timestamp',
        updated_at='updated_at'
    )
}}

SELECT * FROM {{ source('app_db', 'users') }}

{% endsnapshot %}
```

Running `dbt snapshot` automatically tracks changes and maintains
effective_from / effective_to dates.

---

## Exercises

1. **Project setup**: Initialize a dbt project with DuckDB as the
   backend. Create staging models for 3 source tables (users, orders,
   products). Add schema tests for all primary keys.

2. **DAG construction**: Build a 3-layer model (staging -> intermediate
   -> marts) with at least 6 models. Draw the DAG and verify dbt
   builds them in the correct order.

3. **Incremental model**: Create an incremental model for daily event
   aggregation. Run it once with full data, then add new data and
   verify only the new data is processed.

4. **Custom macros**: Write 3 reusable macros: one for date spine
   generation, one for currency conversion, and one for generating
   surrogate keys. Use each in at least one model.

5. **Testing suite**: For your mart models, write tests that verify:
   no negative revenue, all dates are in valid range, referential
   integrity between facts and dimensions, and row counts are within
   expected bounds.

---

[Next: Lesson 09 - Orchestration ->](09-orchestration.md)
