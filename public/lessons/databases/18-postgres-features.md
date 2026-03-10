# Lesson 18: PostgreSQL Superpowers — JSONB, Arrays, Full-Text Search

PostgreSQL is not just a relational database. It has features that let
you handle semi-structured data, search text without Elasticsearch, and
solve problems that would normally require a separate system.

This lesson covers the features that make Postgres the "everything
database."

---

## JSONB: Flexible Data Without Abandoning SQL

JSONB stores JSON data in a binary format that's fast to query and
indexable. It gives you the flexibility of a document database inside
your relational database.

**Analogy:** Think of a filing cabinet (your relational tables) where
most folders have a strict form inside (fixed columns). But some folders
have a manila envelope that can hold whatever loose papers you need
(JSONB). The filing cabinet still organizes everything, but the envelope
handles the unpredictable stuff.

### When to Use JSONB

- User preferences / settings (each user may have different keys)
- API response caching
- Product attributes that vary by category (a laptop has RAM and CPU; a shirt has size and color)
- Event metadata (each event type has different fields)
- Integration data from external systems

### When NOT to Use JSONB

- Data you query by frequently (use real columns)
- Data with a known, stable structure (use real columns)
- Foreign key references (JSONB can't have foreign keys)
- Data you need to aggregate across rows (SUM, AVG on JSONB fields is painful)

**Rule of thumb:** If you'd put an index on it, it should be a column.
If you'd never WHERE/JOIN on it, JSONB is fine.

### Creating Tables With JSONB

```sql
CREATE TABLE products (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price_cents INTEGER NOT NULL,
    attributes JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO products (name, category, price_cents, attributes) VALUES
    ('MacBook Pro 16"', 'laptop', 249900, '{
        "cpu": "M3 Max",
        "ram_gb": 36,
        "storage_gb": 1024,
        "color": "Space Black",
        "ports": ["HDMI", "USB-C", "MagSafe", "SD Card"]
    }'),
    ('ThinkPad X1 Carbon', 'laptop', 189900, '{
        "cpu": "i7-1365U",
        "ram_gb": 16,
        "storage_gb": 512,
        "color": "Black",
        "ports": ["USB-C", "USB-A", "HDMI"]
    }'),
    ('Cotton T-Shirt', 'clothing', 2999, '{
        "size": "L",
        "color": "Navy",
        "material": "100% Cotton",
        "care": ["Machine wash cold", "Tumble dry low"]
    }'),
    ('Running Shoes', 'footwear', 12999, '{
        "size": 10.5,
        "color": "White/Blue",
        "weight_oz": 9.2,
        "terrain": ["road", "track"]
    }');
```

### JSONB Operators

```sql
-- -> returns JSONB (keeps the JSON type)
SELECT name, attributes -> 'cpu' AS cpu_json
FROM products
WHERE category = 'laptop';
-- Result: "M3 Max" (with quotes, it's a JSON string)

-- ->> returns TEXT (extracts as a plain string)
SELECT name, attributes ->> 'cpu' AS cpu_text
FROM products
WHERE category = 'laptop';
-- Result: M3 Max (no quotes, plain text)

-- Nested access: get the first port
SELECT name, attributes -> 'ports' -> 0 AS first_port
FROM products
WHERE category = 'laptop';

-- Cast to a number for comparison
SELECT name, (attributes ->> 'ram_gb')::INT AS ram
FROM products
WHERE category = 'laptop'
  AND (attributes ->> 'ram_gb')::INT >= 32;
```

### Containment Operator: @>

The `@>` operator checks if the left JSONB contains the right JSONB.
This is the most important operator for querying JSONB because it can
use GIN indexes.

```sql
-- Find products with a specific attribute value
SELECT name FROM products
WHERE attributes @> '{"color": "Black"}';

-- Find laptops with USB-C in their ports array
SELECT name FROM products
WHERE attributes @> '{"ports": ["USB-C"]}';

-- Find products with specific nested values
SELECT name FROM products
WHERE attributes @> '{"ram_gb": 16}';
```

### Existence Operator: ?

Check if a key exists:

```sql
-- Products that have a "size" attribute
SELECT name FROM products
WHERE attributes ? 'size';

-- Products that have either "cpu" or "size"
SELECT name FROM products
WHERE attributes ?| ARRAY['cpu', 'size'];

-- Products that have both "cpu" and "ram_gb"
SELECT name FROM products
WHERE attributes ?& ARRAY['cpu', 'ram_gb'];
```

### JSONB Functions

```sql
-- jsonb_each: expand JSONB object into key-value rows
SELECT name, key, value
FROM products, jsonb_each(attributes)
WHERE category = 'laptop';

-- jsonb_each_text: same but values are TEXT
SELECT name, key, value
FROM products, jsonb_each_text(attributes)
WHERE category = 'laptop';

-- jsonb_array_elements: expand a JSONB array into rows
SELECT name, port
FROM products, jsonb_array_elements_text(attributes -> 'ports') AS port
WHERE category = 'laptop';

-- jsonb_object_keys: list all keys
SELECT DISTINCT jsonb_object_keys(attributes) AS attribute_key
FROM products
ORDER BY attribute_key;

-- jsonb_set: update a specific key (returns new JSONB, doesn't mutate)
UPDATE products
SET attributes = jsonb_set(attributes, '{color}', '"Silver"')
WHERE name = 'MacBook Pro 16"';

-- Remove a key
UPDATE products
SET attributes = attributes - 'care'
WHERE name = 'Cotton T-Shirt';

-- Add a new key
UPDATE products
SET attributes = attributes || '{"warranty_months": 24}'::JSONB
WHERE category = 'laptop';
```

### GIN Indexes on JSONB

Without an index, every JSONB query scans the entire table. A GIN
(Generalized Inverted Index) index makes JSONB queries fast.

```sql
CREATE INDEX idx_products_attributes ON products USING GIN (attributes);
```

This single index supports `@>`, `?`, `?|`, and `?&` operators.

```sql
EXPLAIN ANALYZE
SELECT name FROM products WHERE attributes @> '{"color": "Black"}';
```

For indexing a specific path only (more targeted, smaller index):

```sql
CREATE INDEX idx_products_color
    ON products USING GIN ((attributes -> 'color'));
```

### jsonb_path_query: SQL/JSON Path (Postgres 12+)

```sql
-- Find all products where any port is "HDMI"
SELECT name
FROM products
WHERE jsonb_path_exists(attributes, '$.ports[*] ? (@ == "HDMI")');
```

---

## Arrays: Native Multi-Value Columns

PostgreSQL supports array columns — a column that holds multiple values
of the same type.

**Analogy:** A spreadsheet cell that holds a list instead of a single
value. Like a contact card with multiple phone numbers — you don't need
a separate "phone_numbers" table for something this simple.

### Creating and Querying Arrays

```sql
CREATE TABLE articles (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title TEXT NOT NULL,
    tags TEXT[] NOT NULL DEFAULT '{}',
    scores INTEGER[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO articles (title, tags, scores) VALUES
    ('Intro to SQL', ARRAY['sql', 'beginner', 'tutorial'], ARRAY[85, 92, 78]),
    ('Advanced Joins', ARRAY['sql', 'advanced'], ARRAY[95, 88]),
    ('PostgreSQL JSONB', ARRAY['postgresql', 'json', 'advanced'], ARRAY[90, 91, 87, 93]),
    ('Getting Started', ARRAY['beginner', 'tutorial'], ARRAY[70, 75]);
```

### Array Operators

```sql
-- ANY: does the array contain this value?
SELECT title FROM articles WHERE 'advanced' = ANY(tags);

-- ALL: are all values in the array greater than 80?
SELECT title FROM articles WHERE 80 < ALL(scores);

-- @> contains: does tags contain both 'sql' AND 'advanced'?
SELECT title FROM articles WHERE tags @> ARRAY['sql', 'advanced'];

-- <@ is contained by
SELECT title FROM articles WHERE tags <@ ARRAY['sql', 'beginner', 'tutorial'];

-- && overlap: do the arrays share any elements?
SELECT title FROM articles
WHERE tags && ARRAY['beginner', 'intermediate'];

-- Array length
SELECT title, array_length(tags, 1) AS tag_count FROM articles;

-- Access by index (1-based!)
SELECT title, tags[1] AS first_tag FROM articles;

-- Slice
SELECT title, tags[1:2] AS first_two_tags FROM articles;
```

### Array Aggregate and Unnest

```sql
-- unnest: expand an array into rows
SELECT title, unnest(tags) AS tag FROM articles;

-- array_agg: collapse rows into an array
SELECT unnest(tags) AS tag, array_agg(title) AS articles_with_tag
FROM articles
GROUP BY tag
ORDER BY tag;

-- Combine with other queries
SELECT
    tag,
    COUNT(*) AS article_count
FROM articles, unnest(tags) AS tag
GROUP BY tag
ORDER BY article_count DESC;
```

### Appending and Removing

```sql
-- Append to array
UPDATE articles SET tags = array_append(tags, 'database')
WHERE title = 'Intro to SQL';

-- Remove from array
UPDATE articles SET tags = array_remove(tags, 'tutorial')
WHERE title = 'Getting Started';

-- Concatenate arrays
UPDATE articles SET tags = tags || ARRAY['featured', 'top-pick']
WHERE title = 'Advanced Joins';
```

### GIN Index on Arrays

```sql
CREATE INDEX idx_articles_tags ON articles USING GIN (tags);

-- Now these are fast:
SELECT title FROM articles WHERE tags @> ARRAY['sql'];
SELECT title FROM articles WHERE tags && ARRAY['advanced', 'beginner'];
```

### When to Use Arrays vs Junction Tables

| Arrays | Junction Table |
|---|---|
| Few values per row (< 20) | Many values per row |
| Values are simple (strings, ints) | Values are entities with their own data |
| No need to query "all items with tag X" often | Frequent reverse lookups |
| Order matters | Order doesn't matter or is separate |
| No foreign key needed | Need referential integrity |

Tags on a blog post: could go either way. If tags are just strings and
you rarely query "all posts with tag X," an array is simpler. If tags
have descriptions, URLs, and counts, use a junction table.

---

## Full-Text Search

PostgreSQL has built-in full-text search. For many applications, you
don't need Elasticsearch.

**Analogy:** Imagine the index at the back of a textbook. It doesn't
just list words — it understands that "running" and "ran" are forms of
"run." It skips common words like "the" and "a." That's what Postgres
full-text search does.

### Core Concepts

**tsvector:** A processed document, stored as sorted lexemes (word roots)
with positions.

```sql
SELECT to_tsvector('english', 'The quick brown foxes jumped over the lazy dogs');
-- Result: 'brown':3 'dog':9 'fox':4 'jump':5 'lazi':8 'quick':2
```

Notice: "The" is removed (stop word), "foxes" becomes "fox" (stemming),
"jumped" becomes "jump," "lazy" becomes "lazi," and positions are tracked.

**tsquery:** A search query with operators.

```sql
SELECT to_tsquery('english', 'fox & jump');
-- Result: 'fox' & 'jump'

SELECT plainto_tsquery('english', 'brown fox');
-- Result: 'brown' & 'fox'
```

### Searching

```sql
CREATE TABLE docs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO docs (title, body) VALUES
    ('PostgreSQL Tutorial', 'Learn how to use PostgreSQL for your applications. This database supports JSON, arrays, and full-text search.'),
    ('Database Indexing', 'Indexes make your queries faster by creating efficient lookup structures. B-tree indexes are the most common type.'),
    ('Query Optimization', 'Optimizing SQL queries involves understanding the query planner, using EXPLAIN ANALYZE, and creating appropriate indexes.'),
    ('Full-Text Search Guide', 'PostgreSQL full-text search lets you search through documents without external tools like Elasticsearch.'),
    ('NoSQL vs SQL', 'When should you choose NoSQL over SQL? SQL databases excel at structured data with relationships.');

-- Basic search: find documents mentioning "index"
SELECT title, body
FROM docs
WHERE to_tsvector('english', body) @@ to_tsquery('english', 'index');

-- Matches "indexes", "indexing" too (stemming)

-- Search with multiple terms (AND)
SELECT title FROM docs
WHERE to_tsvector('english', body) @@ to_tsquery('english', 'query & optimize');

-- Search with OR
SELECT title FROM docs
WHERE to_tsvector('english', body) @@ to_tsquery('english', 'json | array');

-- Negate (NOT)
SELECT title FROM docs
WHERE to_tsvector('english', body) @@ to_tsquery('english', 'database & !nosql');

-- Phrase search (words adjacent)
SELECT title FROM docs
WHERE to_tsvector('english', body) @@ phraseto_tsquery('english', 'full text search');
```

### Ranking Results

```sql
SELECT
    title,
    ts_rank(to_tsvector('english', body), plainto_tsquery('english', 'postgresql search')) AS rank
FROM docs
WHERE to_tsvector('english', body) @@ plainto_tsquery('english', 'postgresql search')
ORDER BY rank DESC;
```

### Searching Across Multiple Columns

Combine title and body, weighting title higher:

```sql
SELECT
    title,
    ts_rank(
        setweight(to_tsvector('english', title), 'A') ||
        setweight(to_tsvector('english', body), 'B'),
        plainto_tsquery('english', 'postgresql')
    ) AS rank
FROM docs
WHERE
    setweight(to_tsvector('english', title), 'A') ||
    setweight(to_tsvector('english', body), 'B')
    @@ plainto_tsquery('english', 'postgresql')
ORDER BY rank DESC;
```

Weights go from A (highest) to D (lowest). A match in the title ranks
higher than a match in the body.

### Stored tsvector Column + GIN Index

Computing `to_tsvector` on every query is expensive. Store it:

```sql
ALTER TABLE docs ADD COLUMN search_vector tsvector;

UPDATE docs SET search_vector =
    setweight(to_tsvector('english', title), 'A') ||
    setweight(to_tsvector('english', body), 'B');

CREATE INDEX idx_docs_search ON docs USING GIN (search_vector);

-- Keep it up to date with a trigger
CREATE OR REPLACE FUNCTION docs_search_trigger()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.body, '')), 'B');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_docs_search
    BEFORE INSERT OR UPDATE ON docs
    FOR EACH ROW
    EXECUTE FUNCTION docs_search_trigger();
```

Now queries use the pre-computed, indexed column:

```sql
SELECT title, ts_rank(search_vector, q) AS rank
FROM docs, plainto_tsquery('english', 'postgresql index') AS q
WHERE search_vector @@ q
ORDER BY rank DESC;
```

### Highlighting Matches

```sql
SELECT
    title,
    ts_headline('english', body, plainto_tsquery('english', 'index'),
        'StartSel=**, StopSel=**, MaxWords=35, MinWords=15') AS snippet
FROM docs
WHERE search_vector @@ plainto_tsquery('english', 'index');
```

The result wraps matching words with `**` markers (you can use HTML tags
like `<b>` and `</b>` instead).

---

## ENUM Types

Custom types with a fixed set of allowed values:

```sql
CREATE TYPE priority AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TABLE tickets (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title TEXT NOT NULL,
    priority priority NOT NULL DEFAULT 'medium',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO tickets (title, priority) VALUES
    ('Fix login bug', 'critical'),
    ('Update docs', 'low'),
    ('Add dark mode', 'medium');

-- Invalid values are rejected
INSERT INTO tickets (title, priority) VALUES ('Test', 'urgent');
-- ERROR: invalid input value for enum priority: "urgent"

-- ENUMs have an order (the order you defined them)
SELECT title FROM tickets WHERE priority > 'medium' ORDER BY priority;
-- Returns 'critical' tickets
```

### Tradeoffs

- ENUMs are stored as 4 bytes (compact)
- Adding values is easy: `ALTER TYPE priority ADD VALUE 'urgent' AFTER 'high';`
- Removing or renaming values is hard (requires recreating the type)
- For rapidly changing sets of values, consider a lookup table instead

---

## Generated Columns

Columns whose values are computed from other columns, automatically:

```sql
CREATE TABLE people (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    full_name TEXT GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED
);

INSERT INTO people (first_name, last_name) VALUES ('Alice', 'Chen');
SELECT * FROM people;
-- id | first_name | last_name | full_name
--  1 | Alice      | Chen      | Alice Chen

-- full_name updates automatically
UPDATE people SET last_name = 'Smith' WHERE id = 1;
SELECT full_name FROM people WHERE id = 1;
-- Alice Smith
```

Generated columns are always in sync — no trigger needed, no risk of
stale data.

```sql
CREATE TABLE line_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price_cents INTEGER NOT NULL,
    total_cents INTEGER GENERATED ALWAYS AS (quantity * unit_price_cents) STORED
);

INSERT INTO line_items (product_name, quantity, unit_price_cents) VALUES
    ('Widget', 5, 999),
    ('Gadget', 2, 4999);

SELECT product_name, quantity, unit_price_cents, total_cents FROM line_items;
```

---

## LATERAL Joins

A `LATERAL` join lets a subquery reference columns from preceding tables
in the `FROM` clause. Think of it as a "for each row" subquery.

**Analogy:** Regular joins are like merging two spreadsheets by a common
column. A LATERAL join is like saying "for each row in spreadsheet A,
run a custom query against spreadsheet B using values from that specific
row."

```sql
-- For each user, get their 3 most recent posts
SELECT u.username, recent.title, recent.created_at
FROM users u
CROSS JOIN LATERAL (
    SELECT p.title, p.created_at
    FROM posts p
    WHERE p.user_id = u.id
    ORDER BY p.created_at DESC
    LIMIT 3
) AS recent;
```

Without `LATERAL`, you'd need window functions or complex subqueries.

```sql
-- For each category, find the most expensive product
SELECT p.category, top.name, top.price_cents
FROM (SELECT DISTINCT category FROM products) AS p
CROSS JOIN LATERAL (
    SELECT name, price_cents
    FROM products
    WHERE category = p.category
    ORDER BY price_cents DESC
    LIMIT 1
) AS top;
```

Use `LEFT JOIN LATERAL ... ON true` to keep rows even when the subquery
returns no results (like a LEFT JOIN):

```sql
SELECT u.username, recent.title
FROM users u
LEFT JOIN LATERAL (
    SELECT p.title
    FROM posts p
    WHERE p.user_id = u.id
    ORDER BY p.created_at DESC
    LIMIT 1
) AS recent ON true;
```

---

## UPSERT: INSERT ... ON CONFLICT

Insert a row, or update it if it already exists. This eliminates the
"check if exists, then insert or update" pattern that's prone to race
conditions.

```sql
CREATE TABLE user_settings (
    user_id BIGINT NOT NULL REFERENCES users(id),
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, key)
);

-- Insert or update in one atomic statement
INSERT INTO user_settings (user_id, key, value) VALUES (1, 'theme', 'dark')
ON CONFLICT (user_id, key)
DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = NOW();
```

`EXCLUDED` refers to the row that was proposed for insertion. If there's
a conflict, the `DO UPDATE` clause uses the new values from `EXCLUDED`.

```sql
-- Insert if new, do nothing if exists (no error)
INSERT INTO user_settings (user_id, key, value) VALUES (1, 'theme', 'dark')
ON CONFLICT (user_id, key)
DO NOTHING;

-- Conditional update: only update if the new value is different
INSERT INTO user_settings (user_id, key, value) VALUES (1, 'theme', 'light')
ON CONFLICT (user_id, key)
DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = NOW()
WHERE user_settings.value != EXCLUDED.value;
```

### Practical Uses

```sql
-- Page view counter (increment on conflict)
CREATE TABLE page_views (
    page_path TEXT PRIMARY KEY,
    view_count BIGINT NOT NULL DEFAULT 1,
    last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO page_views (page_path) VALUES ('/blog/my-post')
ON CONFLICT (page_path)
DO UPDATE SET
    view_count = page_views.view_count + 1,
    last_viewed_at = NOW();

-- Run the above multiple times and watch view_count increase
SELECT * FROM page_views;
```

---

## Practical: Product Catalog With JSONB and Full-Text Search

Let's build a searchable product catalog that uses JSONB for flexible
attributes and full-text search for finding products by name and
description.

```sql
DROP TABLE IF EXISTS catalog_products CASCADE;

CREATE TABLE catalog_products (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    price_cents INTEGER NOT NULL CHECK (price_cents > 0),
    attributes JSONB NOT NULL DEFAULT '{}',
    tags TEXT[] NOT NULL DEFAULT '{}',
    in_stock BOOLEAN NOT NULL DEFAULT true,
    search_vector tsvector,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_catalog_attributes ON catalog_products USING GIN (attributes);
CREATE INDEX idx_catalog_tags ON catalog_products USING GIN (tags);
CREATE INDEX idx_catalog_search ON catalog_products USING GIN (search_vector);
CREATE INDEX idx_catalog_category ON catalog_products(category);
CREATE INDEX idx_catalog_price ON catalog_products(price_cents);

CREATE OR REPLACE FUNCTION catalog_search_trigger()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.category, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_catalog_search
    BEFORE INSERT OR UPDATE ON catalog_products
    FOR EACH ROW
    EXECUTE FUNCTION catalog_search_trigger();
```

### Seed the Catalog

```sql
INSERT INTO catalog_products (name, description, category, price_cents, attributes, tags) VALUES
    ('Wireless Noise-Cancelling Headphones', 'Premium over-ear headphones with active noise cancellation, 30-hour battery life, and hi-res audio support.', 'electronics', 34999,
     '{"brand": "SoundMax", "battery_hours": 30, "driver_mm": 40, "bluetooth": "5.3", "weight_grams": 250, "colors": ["black", "silver", "navy"]}',
     ARRAY['wireless', 'audio', 'noise-cancelling', 'bluetooth']),

    ('Mechanical Keyboard', 'Compact 75% mechanical keyboard with hot-swappable switches, RGB backlighting, and USB-C connectivity.', 'electronics', 14999,
     '{"brand": "KeyCraft", "layout": "75%", "switches": "Cherry MX Brown", "backlight": "RGB", "connection": "USB-C", "weight_grams": 850}',
     ARRAY['keyboard', 'mechanical', 'usb-c', 'rgb']),

    ('Organic Coffee Beans', 'Single-origin Ethiopian Yirgacheffe beans, medium roast, notes of blueberry and dark chocolate.', 'food', 1899,
     '{"origin": "Ethiopia", "roast": "medium", "weight_grams": 340, "organic": true, "flavor_notes": ["blueberry", "dark chocolate", "citrus"]}',
     ARRAY['coffee', 'organic', 'single-origin']),

    ('Running Shoes Pro', 'Lightweight carbon-plate racing shoes designed for marathon performance, responsive cushioning.', 'footwear', 24999,
     '{"brand": "SwiftRun", "weight_grams": 198, "drop_mm": 8, "sizes": [7, 8, 9, 10, 11, 12], "colors": ["white/orange", "black/green"]}',
     ARRAY['running', 'racing', 'marathon', 'lightweight']),

    ('Cast Iron Skillet', 'Pre-seasoned 12-inch cast iron skillet, oven safe to 500F, works on all cooktops including induction.', 'kitchen', 4999,
     '{"brand": "IronForge", "diameter_inches": 12, "weight_lbs": 8, "oven_safe_f": 500, "induction_compatible": true, "pre_seasoned": true}',
     ARRAY['cooking', 'cast-iron', 'skillet', 'induction']),

    ('Bluetooth Speaker', 'Waterproof portable speaker with 360-degree sound, 20-hour battery, and built-in microphone.', 'electronics', 7999,
     '{"brand": "SoundMax", "battery_hours": 20, "waterproof_rating": "IPX7", "weight_grams": 680, "bluetooth": "5.0"}',
     ARRAY['wireless', 'audio', 'bluetooth', 'waterproof', 'portable']);
```

### Queries

```sql
-- Full-text search: find products mentioning "wireless" or "bluetooth"
SELECT name, ts_rank(search_vector, q) AS rank
FROM catalog_products, plainto_tsquery('english', 'wireless bluetooth') AS q
WHERE search_vector @@ q
ORDER BY rank DESC;

-- JSONB: find products by brand
SELECT name, price_cents / 100.0 AS price
FROM catalog_products
WHERE attributes @> '{"brand": "SoundMax"}';

-- JSONB: find electronics under $200 with bluetooth
SELECT name, price_cents / 100.0 AS price, attributes ->> 'bluetooth' AS bt_version
FROM catalog_products
WHERE category = 'electronics'
  AND price_cents < 20000
  AND attributes ? 'bluetooth';

-- Array: find products tagged with both 'wireless' and 'audio'
SELECT name FROM catalog_products
WHERE tags @> ARRAY['wireless', 'audio'];

-- Combined: full-text search + JSONB filter + price range
SELECT
    name,
    price_cents / 100.0 AS price,
    attributes ->> 'brand' AS brand,
    ts_rank(search_vector, q) AS relevance
FROM catalog_products, plainto_tsquery('english', 'audio sound') AS q
WHERE search_vector @@ q
  AND price_cents < 40000
  AND (attributes ->> 'battery_hours')::INT >= 20
ORDER BY relevance DESC;

-- LATERAL: for each category, find the cheapest product
SELECT cat.category, cheapest.name, cheapest.price_cents / 100.0 AS price
FROM (SELECT DISTINCT category FROM catalog_products) AS cat
CROSS JOIN LATERAL (
    SELECT name, price_cents
    FROM catalog_products
    WHERE category = cat.category
    ORDER BY price_cents ASC
    LIMIT 1
) AS cheapest;

-- Aggregate: tags with product count
SELECT tag, COUNT(*) AS product_count
FROM catalog_products, unnest(tags) AS tag
GROUP BY tag
ORDER BY product_count DESC, tag;

-- UPSERT: update or insert a product view count
CREATE TABLE product_views (
    product_id BIGINT PRIMARY KEY REFERENCES catalog_products(id),
    view_count BIGINT NOT NULL DEFAULT 1,
    last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO product_views (product_id) VALUES (1)
ON CONFLICT (product_id)
DO UPDATE SET
    view_count = product_views.view_count + 1,
    last_viewed_at = NOW();
```

---

## Exercises

### Exercise 1: JSONB Querying

Using the `catalog_products` table:
1. Find all products where the `weight_grams` attribute is less than 300.
2. Find all products that have a `colors` key in their attributes.
3. Extract all unique flavor notes across all products (hint: `jsonb_array_elements_text`).
4. Update the headphones to add a `"noise_cancellation": "active"` attribute without overwriting existing attributes.

### Exercise 2: Full-Text Search

1. Search for products related to "cooking kitchen iron" and rank the results.
2. Create a query that highlights matching words in the description using `ts_headline`.
3. Search for the phrase "carbon plate" (must be adjacent words).
4. Find products that match "battery" but NOT "speaker".

### Exercise 3: Arrays

1. Find all products that have at least 3 tags.
2. Find products whose tags overlap with `ARRAY['organic', 'lightweight', 'portable']`.
3. Add the tag `'gift-idea'` to all products priced under $100.
4. Write a query that returns each tag and the average price of products with that tag.

### Exercise 4: UPSERT Patterns

Create a `product_inventory` table with `product_id`, `warehouse`, and
`quantity` columns. Write an upsert that:
- Inserts a new inventory record if one doesn't exist
- Adds to the existing quantity if one does exist
- Tracks when inventory was last updated

### Exercise 5: Build a Search API Query

Write a single query that accepts search parameters and returns results.
The query should support:
- Free text search (full-text search on name + description)
- Category filter
- Price range (min and max)
- Tag filter (must have all specified tags)
- Attribute filter (e.g., brand = X)
- Sorted by relevance, then price

---

## Key Takeaways

1. **JSONB** is for flexible, semi-structured data. Use it for metadata, not for structured fields you query frequently.
2. **GIN indexes** make JSONB and array queries fast. Always add them.
3. **@> (containment)** is the go-to JSONB operator for indexed lookups.
4. **Arrays** work for small, simple multi-value columns. Use junction tables for complex relationships.
5. **Full-text search** is built into Postgres. Store a `tsvector` column and index it with GIN.
6. **Weights** (A-D) let you rank title matches above body matches.
7. **ENUMs** enforce valid values at the type level.
8. **Generated columns** compute derived values automatically.
9. **LATERAL joins** let subqueries reference the outer row — like a "for each" loop.
10. **UPSERT** eliminates the "check then insert/update" race condition.

Next: [Lesson 19 — Common Mistakes and Anti-Patterns](./19-anti-patterns.md)
