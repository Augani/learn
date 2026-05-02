# Lesson 09: Schema Design and Normalization

Your database schema is the blueprint for your data. Get it wrong and you'll
fight it for the lifetime of the application. Get it right and the database
does most of the heavy lifting for you.

---

## Why Schema Design Matters

Imagine a spreadsheet where every row about an order also contains the
customer's full address, phone number, and email. When a customer moves,
you have to update hundreds of rows. Miss one? Now the same customer has
two different addresses. This is the core problem normalization solves.

**Analogy — a paper address book vs. a contact list with IDs:**

In a paper address book, you write "Alice, 123 Main St" on every page she
appears. If Alice moves, you hunt through the whole book updating every
mention. In a normalized design, Alice's address lives in ONE place. Every
reference to Alice just uses her ID.

---

## Normalization: The Rules

Normalization is a set of progressive rules (called "normal forms") that
eliminate data duplication and inconsistency. Each level builds on the last.

### First Normal Form (1NF): Each Cell Has One Value

**Rule:** Every column holds a single, atomic value. No lists, no comma-
separated strings, no arrays packed into a text field.

**Bad — violates 1NF:**

```
 id | name  | phone_numbers
----+-------+---------------------------
  1 | Alice | 555-1234, 555-5678
  2 | Bob   | 555-9999
```

Alice has two phone numbers jammed into one cell. You can't easily query
"find all people with phone number 555-5678" without string parsing.

**Good — satisfies 1NF:**

```sql
CREATE TABLE contacts (
    contact_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE phone_numbers (
    phone_id SERIAL PRIMARY KEY,
    contact_id INTEGER NOT NULL REFERENCES contacts(contact_id),
    phone_number TEXT NOT NULL
);

INSERT INTO contacts (name) VALUES ('Alice'), ('Bob');
INSERT INTO phone_numbers (contact_id, phone_number) VALUES
    (1, '555-1234'),
    (1, '555-5678'),
    (2, '555-9999');
```

Now you can query phone numbers directly:

```sql
SELECT c.name, p.phone_number
FROM contacts c
JOIN phone_numbers p ON c.contact_id = p.contact_id
WHERE p.phone_number = '555-5678';
```

**Analogy:** 1NF is like the rule "one item per box on a form." If the
form asks for your phone number and you write three numbers in one box,
the system reading the form can't tell where one number ends and the next
begins.

### Second Normal Form (2NF): Depend on the FULL Key

**Rule:** Every non-key column must depend on the entire primary key, not
just part of it. This only matters when your primary key is composite
(made of multiple columns).

**Bad — violates 2NF:**

Suppose you track which students take which courses, with a composite key
of `(student_id, course_id)`:

```
 student_id | course_id | student_name | course_title | grade
------------+-----------+--------------+--------------+------
          1 |       101 | Alice        | Databases    | A
          1 |       102 | Alice        | Networks     | B
          2 |       101 | Bob          | Databases    | C
```

`student_name` depends only on `student_id` (not on `course_id`).
`course_title` depends only on `course_id`. They don't depend on the
FULL key. If Alice changes her name, you update multiple rows.

**Good — satisfies 2NF:**

```sql
CREATE TABLE students (
    student_id SERIAL PRIMARY KEY,
    student_name TEXT NOT NULL
);

CREATE TABLE courses (
    course_id SERIAL PRIMARY KEY,
    course_title TEXT NOT NULL
);

CREATE TABLE enrollments (
    student_id INTEGER REFERENCES students(student_id),
    course_id INTEGER REFERENCES courses(course_id),
    grade CHAR(1),
    PRIMARY KEY (student_id, course_id)
);
```

Now `student_name` lives in one place. `course_title` lives in one place.
The `enrollments` table only stores the relationship and the grade, which
genuinely depends on both `student_id` and `course_id`.

**Analogy:** 2NF is like saying "don't store your mailing address on every
receipt." Your address belongs in your customer profile, not repeated on
every transaction. The receipt only needs to reference your customer ID.

### Third Normal Form (3NF): No Transitive Dependencies

**Rule:** No non-key column should depend on another non-key column. Every
non-key column depends directly on the primary key, and nothing else.

**Bad — violates 3NF:**

```
 employee_id | department_id | department_name | department_head
-------------+---------------+-----------------+----------------
           1 |            10 | Engineering     | Carol
           2 |            10 | Engineering     | Carol
           3 |            20 | Marketing       | Dave
```

`department_name` and `department_head` depend on `department_id`, not on
`employee_id`. If Carol leaves, you update every Engineering row.

**Good — satisfies 3NF:**

```sql
CREATE TABLE departments (
    department_id SERIAL PRIMARY KEY,
    department_name TEXT NOT NULL,
    department_head TEXT
);

CREATE TABLE employees (
    employee_id SERIAL PRIMARY KEY,
    department_id INTEGER REFERENCES departments(department_id),
    name TEXT NOT NULL
);
```

Now department info lives in exactly one place.

**Analogy:** 3NF says "don't store your city's zip code on your personal
profile." Your city determines the zip code, not you. Store the zip code
in a cities table. Your profile just references the city.

### Quick Summary

| Normal Form | Rule | Fix |
|-------------|------|-----|
| 1NF | One value per cell | Split lists into separate rows/tables |
| 2NF | Depend on the full key | Move partial-key dependencies to their own table |
| 3NF | No transitive dependencies | Move non-key-to-non-key dependencies to their own table |

---

## Denormalization: When to Break the Rules

Normalization prevents data anomalies. But it also means more JOINs, and
JOINs have a cost. Sometimes you intentionally break normalization for
performance.

**When denormalization makes sense:**
- Read-heavy workloads where the same expensive JOIN runs thousands of
  times per second
- Reporting or analytics tables that are rebuilt periodically
- Caching computed values (like `order_total` stored on the `orders` row
  instead of summing `order_items` every time)
- Counters (like `follower_count` on a user profile)

**When denormalization is a bad idea:**
- The data changes frequently (now you have to update it in multiple places)
- You don't have a plan for keeping the copies in sync
- You're doing it prematurely, before you've measured a performance problem

**Analogy:** A fully normalized schema is like a warehouse where every
unique item has exactly one shelf location. Efficient for storage, but if
the delivery truck needs to assemble 50 orders per hour, it spends all its
time running between shelves. Denormalization is like putting the 10 most
popular items on a table near the loading dock. You're duplicating
inventory locations, but the truck loads faster. The tradeoff: when the
price of a popular item changes, you have to update it in two places.

---

## Relationships Between Tables

### One-to-One

One row in table A maps to exactly one row in table B. Rare, but useful
for splitting large rows or storing optional extended data.

```sql
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE
);

CREATE TABLE user_profiles (
    user_id INTEGER PRIMARY KEY REFERENCES users(user_id),
    bio TEXT,
    avatar_url TEXT,
    date_of_birth DATE
);
```

The `user_profiles.user_id` is both the primary key AND a foreign key.
One user has at most one profile.

**When to use:** When some columns are accessed rarely (a big bio text)
or are optional, and you want the main table to stay slim.

### One-to-Many

One row in table A maps to many rows in table B. This is the most common
relationship.

```sql
CREATE TABLE authors (
    author_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE books (
    book_id SERIAL PRIMARY KEY,
    author_id INTEGER NOT NULL REFERENCES authors(author_id),
    title TEXT NOT NULL
);
```

One author writes many books. The "many" side (`books`) holds the foreign
key pointing back to the "one" side (`authors`).

**Analogy:** One parent has many children. You don't store all the
children's names in a single column on the parent's record. Each child
gets their own row with a `parent_id`.

### Many-to-Many

Many rows in table A relate to many rows in table B. A book can have
multiple tags, and a tag can be on multiple books. You can't represent
this with a single foreign key on either side.

**Solution: a junction table (also called a join table, bridge table, or
associative table):**

```sql
CREATE TABLE books (
    book_id SERIAL PRIMARY KEY,
    title TEXT NOT NULL
);

CREATE TABLE tags (
    tag_id SERIAL PRIMARY KEY,
    tag_name TEXT NOT NULL UNIQUE
);

CREATE TABLE book_tags (
    book_id INTEGER REFERENCES books(book_id),
    tag_id INTEGER REFERENCES tags(tag_id),
    PRIMARY KEY (book_id, tag_id)
);
```

The junction table `book_tags` holds pairs of foreign keys. Each row says
"this book has this tag."

```sql
INSERT INTO books (title) VALUES ('Database Internals'), ('Designing Data-Intensive Applications');
INSERT INTO tags (tag_name) VALUES ('databases'), ('distributed-systems'), ('architecture');

INSERT INTO book_tags (book_id, tag_id) VALUES
    (1, 1),
    (2, 1),
    (2, 2),
    (2, 3);

SELECT b.title, t.tag_name
FROM books b
JOIN book_tags bt ON b.book_id = bt.book_id
JOIN tags t ON bt.tag_id = t.tag_id;
```

**Analogy:** Think of a class schedule. Students take many classes, and
each class has many students. The enrollment list is the junction table,
connecting student IDs to class IDs.

---

## Naming Conventions

Consistent naming makes your schema readable and your queries predictable.
Here's a widely-used convention:

| Rule | Example | Rationale |
|------|---------|-----------|
| snake_case for everything | `user_id`, `created_at` | Postgres folds unquoted names to lowercase anyway |
| Plural table names | `users`, `orders`, `order_items` | A table is a collection of rows |
| Singular column names | `user_id`, `email`, `name` | Each column describes one attribute of one row |
| `_id` suffix for keys | `user_id`, `order_id` | Immediately obvious it's an identifier |
| Foreign key = referenced table's key | `orders.user_id` references `users.user_id` | JOINs read naturally: `ON orders.user_id = users.user_id` |
| Junction table = both table names | `book_tags`, `order_items` | Describes what the table connects |
| Timestamps: `created_at`, `updated_at` | `created_at TIMESTAMPTZ` | Universal convention |
| Booleans: `is_` or `has_` prefix | `is_active`, `has_verified_email` | Reads naturally in queries |

**Avoid:**
- CamelCase (`userId`) — requires quoting in Postgres: `"userId"`
- Abbreviations (`usr_id`, `qty`) — save a few characters, lose clarity
- Generic names (`data`, `value`, `type`) — tell you nothing

---

## Practical Example: E-Commerce Schema

Let's design a schema for an e-commerce application. These are the real
tables you'd need.

```sql
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE categories (
    category_id SERIAL PRIMARY KEY,
    category_name TEXT NOT NULL UNIQUE,
    parent_category_id INTEGER REFERENCES categories(category_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE products (
    product_id SERIAL PRIMARY KEY,
    sku TEXT NOT NULL UNIQUE,
    product_name TEXT NOT NULL,
    description TEXT,
    price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
    stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    category_id INTEGER REFERENCES categories(category_id),
    is_available BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE orders (
    order_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
    shipping_address TEXT NOT NULL,
    order_total_cents INTEGER NOT NULL CHECK (order_total_cents >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
    order_item_id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(order_id),
    product_id INTEGER NOT NULL REFERENCES products(product_id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
    UNIQUE (order_id, product_id)
);
```

Let's walk through the design decisions:

**Why `price_cents` instead of `NUMERIC` or `DECIMAL`?**
Storing money as integers (cents) avoids floating-point rounding. $19.99
is stored as `1999`. No decimals, no surprises. When you display it,
divide by 100 in your application code.

**Why `order_total_cents` on the order (denormalization)?**
Strictly normalized, you'd always `SUM(quantity * unit_price_cents)` from
`order_items`. But that's an expensive query for a value that never
changes after the order is placed. Storing it is pragmatic denormalization.

**Why `unit_price_cents` on `order_items`?**
The product price can change tomorrow. The order captures the price at
the time of purchase. If you only stored `product_id`, a price change
would retroactively alter past orders.

**Why `categories` references itself?**
`parent_category_id` creates a tree. "Electronics > Phones > Smartphones"
is three rows where each points to its parent. This is a self-referencing
one-to-many relationship.

**Relationships in this schema:**
- `users` ---(one-to-many)---> `orders` (one user places many orders)
- `orders` ---(one-to-many)---> `order_items` (one order has many items)
- `products` ---(one-to-many)---> `order_items` (one product appears in many orders)
- `categories` ---(one-to-many, self-ref)---> `categories` (one category has subcategories)
- `users` ---(many-to-many via `orders`+`order_items`)---> `products`

Let's insert some test data and query it:

```sql
INSERT INTO users (email, password_hash, full_name) VALUES
    ('alice@example.com', 'hash_abc', 'Alice Johnson'),
    ('bob@example.com', 'hash_def', 'Bob Smith');

INSERT INTO categories (category_name) VALUES ('Electronics'), ('Books');
INSERT INTO categories (category_name, parent_category_id) VALUES ('Phones', 1), ('Laptops', 1);

INSERT INTO products (sku, product_name, price_cents, stock_quantity, category_id) VALUES
    ('PHN-001', 'Smartphone X', 79999, 50, 3),
    ('PHN-002', 'Budget Phone', 29999, 200, 3),
    ('LPT-001', 'Developer Laptop', 149999, 30, 4),
    ('BK-001', 'SQL Deep Dive', 4999, 500, 2);

INSERT INTO orders (user_id, status, shipping_address, order_total_cents) VALUES
    (1, 'confirmed', '123 Main St, Springfield', 84998);

INSERT INTO order_items (order_id, product_id, quantity, unit_price_cents) VALUES
    (1, 1, 1, 79999),
    (1, 4, 1, 4999);
```

Query: what did Alice order?

```sql
SELECT
    u.full_name,
    p.product_name,
    oi.quantity,
    oi.unit_price_cents / 100.0 AS unit_price,
    o.status
FROM orders o
JOIN users u ON o.user_id = u.user_id
JOIN order_items oi ON o.order_id = oi.order_id
JOIN products p ON oi.product_id = p.product_id
WHERE u.email = 'alice@example.com';
```

---

## Exercises

**Exercise 1: Spot the normalization violations**

This table tracks employees, their departments, and their projects:

```
 emp_id | emp_name | dept  | dept_manager | projects
--------+----------+-------+--------------+------------------------
      1 | Alice    | Eng   | Carol        | API, Dashboard
      2 | Bob      | Eng   | Carol        | API
      3 | Charlie  | Sales | Dave         | CRM, Outreach, API
```

Identify which normal form each violation breaks. Then write the CREATE
TABLE statements that fix all of them.

**Exercise 2: Design a blog schema**

Design a schema for a blog platform with these requirements:
- Users can write posts
- Posts belong to exactly one category
- Posts can have multiple tags (and tags apply to multiple posts)
- Users can leave comments on posts
- Comments can be replies to other comments (nested)

Write the `CREATE TABLE` statements. Consider: where do foreign keys go?
Which relationships are one-to-many and which are many-to-many?

**Exercise 3: Denormalization decision**

You have a social media app. The `posts` table has 50 million rows. Every
time someone views a post, the app runs:

```sql
SELECT COUNT(*) FROM likes WHERE post_id = 42;
```

This query runs 10,000 times per second across all posts. Propose a
denormalization strategy. Write the SQL to implement it, and explain what
could go wrong if you're not careful.

**Exercise 4: From requirements to schema**

A library system needs to track:
- Books (title, ISBN, publication year)
- Authors (a book can have multiple authors)
- Members (name, email, membership date)
- Loans (which member borrowed which book, when, and when it was returned)
- A book can have multiple copies, and each copy is loaned independently

Design the schema. Pay attention to which entity represents "a physical
copy" vs. "a title." Write `CREATE TABLE` statements and insert sample
data showing two copies of the same book, one currently on loan.

---

Next: [Lesson 10: Constraints, Foreign Keys, and Data Integrity](./10-constraints.md)
