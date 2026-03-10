# Lesson 10: Constraints, Foreign Keys, and Data Integrity

Your application code has bugs. Every application does. Constraints are
the database saying "I don't care what your code does, THIS data rule
will never be violated."

---

## Why Constraints Matter

Without constraints, your database is just a dumb bucket that accepts
whatever you throw in. Negative prices? Sure. Orders for nonexistent
users? No problem. Two users with the same email? Why not.

Then months later, your code crashes on a null value that should never
have existed, or a report shows impossible data, and you spend days
tracking down which code path let the bad data in.

**Analogy — guardrails on a mountain highway:**

You could drive a mountain road without guardrails. A careful driver
stays on the road just fine. But one distracted moment, one icy patch,
and you're off the cliff. Guardrails don't slow down good drivers, but
they prevent catastrophe when something goes wrong. Constraints are
guardrails for your data.

---

## Setup

Let's work with a fresh set of tables. Run this in your `learn_db`
database:

```sql
DROP TABLE IF EXISTS order_items, orders, products, users CASCADE;
```

---

## NOT NULL — "This Column Must Have a Value"

The simplest constraint. The column cannot contain NULL.

```sql
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    bio TEXT
);
```

`email` and `full_name` must always have values. `bio` is optional.

```sql
INSERT INTO users (email, full_name) VALUES ('alice@example.com', 'Alice');

INSERT INTO users (email) VALUES ('bob@example.com');
```

The second INSERT fails:

```
ERROR:  null value in column "full_name" violates not-null constraint
```

**When to use NOT NULL:** Almost everywhere. Columns should be NOT NULL
by default and only nullable when there's a genuine reason a value might
not exist yet. In the same way that a well-typed language uses `Option<T>`
or `T | null` explicitly, your schema should make nullability a deliberate
choice.

**Analogy:** A NOT NULL constraint is like a required field on a web form.
The form won't submit until you fill it in. The database won't accept the
row until the column has a value.

---

## UNIQUE — "No Two Rows Can Have the Same Value"

Ensures that every value in the column (or combination of columns) is
distinct across all rows.

```sql
ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
```

(If you created the table with `email TEXT NOT NULL UNIQUE`, this is
already in place. We'll use ALTER TABLE to show how to add constraints
after the fact.)

```sql
INSERT INTO users (email, full_name) VALUES ('alice@example.com', 'Alice Two');
```

```
ERROR:  duplicate key value violates unique constraint "users_email_unique"
DETAIL:  Key (email)=(alice@example.com) already exists.
```

**Multi-column UNIQUE:**

```sql
CREATE TABLE user_preferences (
    user_id INTEGER NOT NULL,
    preference_key TEXT NOT NULL,
    preference_value TEXT NOT NULL,
    UNIQUE (user_id, preference_key)
);
```

The combination of `(user_id, preference_key)` must be unique. User 1 can
have a "theme" preference and a "language" preference, but not two "theme"
preferences.

**Important:** UNIQUE allows multiple NULLs by default in PostgreSQL. Two
rows with `NULL` in a UNIQUE column don't violate the constraint because
`NULL != NULL` in SQL.

---

## PRIMARY KEY — "The Unique Identity of Each Row"

A PRIMARY KEY is `UNIQUE` + `NOT NULL`. Every table should have one. It's
how you refer to a specific row from other tables.

```sql
CREATE TABLE products (
    product_id SERIAL PRIMARY KEY,
    sku TEXT NOT NULL UNIQUE,
    product_name TEXT NOT NULL,
    price_cents INTEGER NOT NULL
);
```

`product_id` is the primary key (auto-incrementing integer). `sku` is also
unique but it's a natural key (meaningful to the business) vs. a surrogate
key (meaningless integer used purely for referencing).

**Composite primary keys** use multiple columns:

```sql
CREATE TABLE order_items (
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    PRIMARY KEY (order_id, product_id)
);
```

No combination of `(order_id, product_id)` can repeat. Each order can
contain a given product only once (you'd increase the quantity instead of
adding a duplicate row).

---

## FOREIGN KEY — "This Value Must Exist in Another Table"

A foreign key ensures referential integrity: you can't reference a row
that doesn't exist.

```sql
CREATE TABLE orders (
    order_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id),
    order_total_cents INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`REFERENCES users(user_id)` means every `user_id` value in `orders` must
exist in `users.user_id`. You can't create an order for user 999 if user
999 doesn't exist.

```sql
INSERT INTO orders (user_id, order_total_cents) VALUES (999, 5000);
```

```
ERROR:  insert or update on table "orders" violates foreign key constraint
DETAIL:  Key (user_id)=(999) is not present in table "users".
```

**Analogy:** A foreign key is like a ticket that must match a real event.
You can't buy a ticket for "Concert #999" if Concert #999 doesn't exist
in the events system. The system checks before issuing the ticket.

### ON DELETE — What Happens When the Referenced Row Is Deleted?

This is where foreign keys get interesting. What should happen to orders
when you delete a user?

#### ON DELETE RESTRICT (default)

Prevent the deletion entirely if any rows reference it:

```sql
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_user_id_fkey;
ALTER TABLE orders ADD CONSTRAINT orders_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT;
```

```sql
DELETE FROM users WHERE user_id = 1;
```

```
ERROR:  update or delete on table "users" violates foreign key constraint
DETAIL:  Key (user_id)=(1) is still referenced from table "orders".
```

You must delete all orders for user 1 first, then delete the user.

**When to use:** When child records must never become orphans. Deleting
a user who has orders would mean orders with no user, which makes no
sense for an e-commerce system.

#### ON DELETE CASCADE

Automatically delete all child rows when the parent is deleted:

```sql
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;

CREATE TABLE orders (
    order_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    order_total_cents INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO orders (user_id, order_total_cents) VALUES (1, 5000);

SELECT * FROM orders;
DELETE FROM users WHERE user_id = 1;
SELECT * FROM orders;
```

The order vanishes when user 1 is deleted. CASCADE "cascades" the delete
down to all referencing rows.

**When to use:** When child records have no meaning without their parent.
If you delete a blog post, its comments should go too. If you delete a
shopping cart, its cart items should go too.

**Danger:** CASCADE can delete far more than you expect. If orders CASCADE
deletes, and order_items also CASCADE from orders, deleting one user
wipes out users, orders, AND order_items. Trace the chain before using it.

#### ON DELETE SET NULL

Set the foreign key column to NULL instead of deleting:

```sql
DROP TABLE IF EXISTS orders CASCADE;

CREATE TABLE orders (
    order_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    order_total_cents INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Note: `user_id` is no longer NOT NULL. It must allow NULLs for SET NULL
to work.

```sql
INSERT INTO users (email, full_name) VALUES ('charlie@example.com', 'Charlie');
INSERT INTO orders (user_id, order_total_cents) VALUES (
    (SELECT user_id FROM users WHERE email = 'charlie@example.com'),
    7500
);

DELETE FROM users WHERE email = 'charlie@example.com';
SELECT * FROM orders;
```

The order still exists, but `user_id` is now NULL. The order record
survives for accounting purposes even if the user account is deleted.

**When to use:** When the child record should survive but the
relationship can become "unknown." An article written by a deleted user
might show "Author: [deleted]."

#### ON DELETE SET DEFAULT

Like SET NULL, but sets the column to its DEFAULT value instead. Rarely
used, but useful for things like reassigning orphaned records to a
"system" user.

### Quick Reference

| Action | What happens to child rows | Use when |
|--------|--------------------------|----------|
| RESTRICT | Parent can't be deleted | Children must never be orphaned |
| CASCADE | Children are deleted too | Children are meaningless without parent |
| SET NULL | FK column becomes NULL | Record should survive, relationship optional |
| SET DEFAULT | FK column gets default value | Reassign to a fallback/system entity |

---

## CHECK — "This Value Must Satisfy a Condition"

CHECK constraints let you define arbitrary boolean conditions on column
values.

```sql
DROP TABLE IF EXISTS products CASCADE;

CREATE TABLE products (
    product_id SERIAL PRIMARY KEY,
    product_name TEXT NOT NULL,
    price_cents INTEGER NOT NULL CHECK (price_cents > 0),
    stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    weight_kg NUMERIC CHECK (weight_kg > 0),
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'active', 'discontinued'))
);
```

Let's test them:

```sql
INSERT INTO products (product_name, price_cents) VALUES ('Free Thing', 0);
```

```
ERROR:  new row for relation "products" violates check constraint "products_price_cents_check"
DETAIL:  Failing row contains (1, Free Thing, 0, 0, null, draft).
```

```sql
INSERT INTO products (product_name, price_cents, stock_quantity) VALUES ('Widget', 999, -5);
```

```
ERROR:  new row for relation "products" violates check constraint "products_stock_quantity_check"
```

```sql
INSERT INTO products (product_name, price_cents, status) VALUES ('Widget', 999, 'invalid');
```

```
ERROR:  new row for relation "products" violates check constraint "products_status_check"
```

**Multi-column CHECK:**

```sql
CREATE TABLE events (
    event_id SERIAL PRIMARY KEY,
    event_name TEXT NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    CHECK (ends_at > starts_at)
);
```

An event can't end before it starts. Your code might have a bug that swaps
the two times. The database won't let it through.

```sql
INSERT INTO events (event_name, starts_at, ends_at)
VALUES ('Backwards Event', '2025-12-31 23:00', '2025-12-31 20:00');
```

```
ERROR:  new row for relation "events" violates check constraint "events_check"
```

**Analogy:** CHECK constraints are like validation rules on a form that
run on the server side. The client might send garbage, but the server
rejects it. Except the database is an even deeper safety net, catching
things that your server code misses.

---

## DEFAULT — "Use This Value If None Is Provided"

DEFAULT gives a column a fallback value when the INSERT doesn't specify one.

```sql
CREATE TABLE audit_log (
    log_id SERIAL PRIMARY KEY,
    action TEXT NOT NULL,
    performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    performed_by TEXT NOT NULL DEFAULT 'system'
);

INSERT INTO audit_log (action) VALUES ('server_started');
SELECT * FROM audit_log;
```

```
 log_id |    action      |         performed_at          | performed_by
--------+----------------+-------------------------------+--------------
      1 | server_started | 2025-01-15 14:30:22.123456+00 | system
```

`performed_at` got the current timestamp and `performed_by` got 'system'
without specifying them.

**Common DEFAULT values:**
- `DEFAULT now()` for timestamps
- `DEFAULT true` / `DEFAULT false` for booleans
- `DEFAULT 0` for counters
- `DEFAULT 'pending'` for status columns
- `DEFAULT gen_random_uuid()` for UUID primary keys (Postgres 13+)

---

## EXCLUSION Constraints — "No Two Rows Can Conflict"

Exclusion constraints are a PostgreSQL-specific generalization of UNIQUE.
They prevent rows from "overlapping" based on an operator.

The classic use case: preventing overlapping time ranges (double-booking
a meeting room).

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE room_bookings (
    booking_id SERIAL PRIMARY KEY,
    room_name TEXT NOT NULL,
    booked_during TSTZRANGE NOT NULL,
    EXCLUDE USING GIST (room_name WITH =, booked_during WITH &&)
);
```

This says: no two rows can have the same `room_name` AND overlapping
`booked_during` ranges.

```sql
INSERT INTO room_bookings (room_name, booked_during)
VALUES ('Conference A', '[2025-03-01 09:00, 2025-03-01 10:00)');

INSERT INTO room_bookings (room_name, booked_during)
VALUES ('Conference A', '[2025-03-01 09:30, 2025-03-01 11:00)');
```

```
ERROR:  conflicting key value violates exclusion constraint "room_bookings_room_name_booked_during_excl"
DETAIL:  Key (room_name, booked_during)=(Conference A, ["2025-03-01 09:30:00+00","2025-03-01 11:00:00+00")) conflicts with existing key (room_name, booked_during)=(Conference A, ["2025-03-01 09:00:00+00","2025-03-01 10:00:00+00")).
```

The second booking overlaps with the first (9:30 falls within 9:00-10:00).
Postgres rejects it.

A different room at the same time is fine:

```sql
INSERT INTO room_bookings (room_name, booked_during)
VALUES ('Conference B', '[2025-03-01 09:30, 2025-03-01 11:00)');
```

**When to use:** Scheduling systems, reservation systems, IP range
allocation, any domain where "overlapping" entries are invalid.

---

## Putting It All Together

Let's build a complete, well-constrained mini-schema and try to break it:

```sql
DROP TABLE IF EXISTS order_items, orders, products, users, events,
    audit_log, room_bookings, user_preferences CASCADE;

CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE products (
    product_id SERIAL PRIMARY KEY,
    product_name TEXT NOT NULL,
    price_cents INTEGER NOT NULL CHECK (price_cents > 0),
    stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    is_available BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE orders (
    order_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
    order_total_cents INTEGER NOT NULL CHECK (order_total_cents >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
    order_item_id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(product_id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents > 0),
    UNIQUE (order_id, product_id)
);
```

Now let's test every constraint:

```sql
INSERT INTO users (email, full_name) VALUES
    ('alice@example.com', 'Alice'),
    ('bob@example.com', 'Bob');

INSERT INTO products (product_name, price_cents, stock_quantity) VALUES
    ('Widget', 1999, 100),
    ('Gadget', 4999, 50);

-- This should work:
INSERT INTO orders (user_id, status, order_total_cents) VALUES (1, 'pending', 1999);
INSERT INTO order_items (order_id, product_id, quantity, unit_price_cents) VALUES (1, 1, 1, 1999);

-- Try each of these and observe the error messages:

-- 1. Duplicate email
INSERT INTO users (email, full_name) VALUES ('alice@example.com', 'Fake Alice');

-- 2. Null required field
INSERT INTO users (email, full_name) VALUES (NULL, 'No Email');

-- 3. Order for nonexistent user
INSERT INTO orders (user_id, status, order_total_cents) VALUES (999, 'pending', 0);

-- 4. Negative price
INSERT INTO products (product_name, price_cents) VALUES ('Bad Product', -100);

-- 5. Invalid status
INSERT INTO orders (user_id, status, order_total_cents) VALUES (1, 'exploded', 0);

-- 6. Duplicate product in same order
INSERT INTO order_items (order_id, product_id, quantity, unit_price_cents) VALUES (1, 1, 2, 1999);

-- 7. Zero quantity
INSERT INTO order_items (order_id, product_id, quantity, unit_price_cents) VALUES (1, 2, 0, 4999);

-- 8. Delete a user who has orders (RESTRICT)
DELETE FROM users WHERE user_id = 1;

-- 9. Delete an order (CASCADE should remove its items too)
SELECT * FROM order_items WHERE order_id = 1;
DELETE FROM orders WHERE order_id = 1;
SELECT * FROM order_items WHERE order_id = 1;
```

Every single one of those bad operations gets caught. Your application
code doesn't need to be perfect. The database is the last line of defense.

---

## Exercises

**Exercise 1: Add constraints to an existing table**

You have this table with no constraints:

```sql
CREATE TABLE employees (
    id INTEGER,
    email TEXT,
    salary INTEGER,
    department TEXT,
    hire_date DATE
);
```

Add the following constraints using ALTER TABLE:
1. `id` should be the primary key
2. `email` should be unique and not null
3. `salary` must be at least 30000
4. `department` must be one of: 'engineering', 'marketing', 'sales', 'support'
5. `hire_date` must not be in the future (hint: `CHECK (hire_date <= CURRENT_DATE)`)

Write the ALTER TABLE statements and then test each constraint with an
INSERT that should fail.

**Exercise 2: Design with referential integrity**

Create tables for a music streaming service:
- `artists` (id, name)
- `albums` (id, title, artist, release year)
- `tracks` (id, title, album, track number, duration in seconds)
- `playlists` (id, name, owner user)
- `playlist_tracks` (which tracks are in which playlists, with position)

Requirements:
- Deleting an artist should be blocked if they have albums
- Deleting an album should delete all its tracks
- Deleting a track should remove it from all playlists (CASCADE)
- Deleting a playlist should remove its entries from playlist_tracks
- Track numbers within an album must be unique
- Track duration must be positive
- Album release year must be between 1900 and the current year

**Exercise 3: Break the constraints**

Using the "Putting It All Together" schema above, write 10 different
INSERT, UPDATE, or DELETE statements that should each fail due to a
different constraint. For each one, predict the error message before
running it.

**Exercise 4: Constraint trade-offs**

Consider an `inventory_movements` table that logs every stock change
(+10 received, -3 sold, etc.):

```sql
CREATE TABLE inventory_movements (
    movement_id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(product_id),
    quantity_change INTEGER NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

The current stock for any product is `SUM(quantity_change)`. But someone
suggests adding a CHECK constraint to prevent the running total from going
negative. Can you do this with a simple CHECK constraint? Why or why not?
What alternative approaches would you consider?

---

Next: [Lesson 11: EXPLAIN — Reading What the Database Is Doing](./11-explain.md)
