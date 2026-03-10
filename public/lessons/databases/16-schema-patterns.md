# Lesson 16: Schema Design Patterns for Real Applications

You know SQL. You can write queries, create tables, add indexes. But when
you sit down to design a real schema — a blog, an e-commerce site, a SaaS
app — you face a different kind of challenge. How do you model
relationships? How do you handle deletions? What do IDs look like?

This lesson covers the patterns you'll use over and over in every
application you build.

---

## One-to-Many: The Most Common Pattern

One user writes many posts. One post has many comments. One order has many
line items. This is the bread-and-butter of relational databases.

**Analogy:** A parent with children. Each child has exactly one
biological mother, but a mother can have many children. The child "knows"
who their parent is — not the other way around.

```sql
CREATE TABLE users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE posts (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_posts_user_id ON posts(user_id);
```

The foreign key `user_id` on `posts` points back to `users`. The "many"
side always holds the reference. You never put an array of post IDs on
the user row.

```sql
INSERT INTO users (username, email) VALUES
    ('alice', 'alice@example.com'),
    ('bob', 'bob@example.com');

INSERT INTO posts (user_id, title, body) VALUES
    (1, 'Hello World', 'My first post!'),
    (1, 'Second Post', 'Still going.'),
    (2, 'Bob here', 'I also write.');

SELECT u.username, p.title
FROM users u
JOIN posts p ON p.user_id = u.id;
```

**Always index foreign keys.** Postgres does NOT automatically index
them. Without `idx_posts_user_id`, every query that joins users to posts
scans the entire posts table.

---

## Many-to-Many: Junction Tables

A student takes many courses. A course has many students. Neither side
"owns" the relationship — you need a table in the middle.

**Analogy:** Think of a wedding guest list. Each guest can attend many
weddings, and each wedding has many guests. The invitation (junction
table) connects one guest to one wedding. Without invitations, there's
no way to know who's going where.

```sql
CREATE TABLE students (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE courses (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    credits INT NOT NULL
);

CREATE TABLE enrollments (
    student_id BIGINT NOT NULL REFERENCES students(id),
    course_id BIGINT NOT NULL REFERENCES courses(id),
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    grade TEXT,
    PRIMARY KEY (student_id, course_id)
);

CREATE INDEX idx_enrollments_course_id ON enrollments(course_id);
```

The junction table (`enrollments`) has a composite primary key — the
combination of student and course must be unique. This means a student
can't enroll in the same course twice.

Junction tables often carry their own data. Here, `enrolled_at` and
`grade` belong to the relationship itself, not to either student or
course.

```sql
INSERT INTO students (name) VALUES ('Alice'), ('Bob'), ('Charlie');
INSERT INTO courses (name, credits) VALUES
    ('Databases', 3), ('Algorithms', 4), ('Networks', 3);

INSERT INTO enrollments (student_id, course_id) VALUES
    (1, 1), (1, 2),
    (2, 1), (2, 3),
    (3, 2);

SELECT s.name AS student, c.name AS course
FROM enrollments e
JOIN students s ON s.id = e.student_id
JOIN courses c ON c.id = e.course_id
ORDER BY s.name, c.name;
```

---

## Self-Referential: When a Table Points to Itself

Employees have managers. But managers are also employees. A category can
have a parent category. A comment can be a reply to another comment.

**Analogy:** A family tree. Every person in the tree is the same type
(a person), but each person points to their parent, who is also a person
in the same tree.

```sql
CREATE TABLE employees (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    manager_id BIGINT REFERENCES employees(id)
);

CREATE INDEX idx_employees_manager_id ON employees(manager_id);

INSERT INTO employees (name, title, manager_id) VALUES
    ('Sarah', 'CEO', NULL),
    ('James', 'VP Engineering', 1),
    ('Maria', 'VP Marketing', 1),
    ('Chen', 'Senior Engineer', 2),
    ('Priya', 'Engineer', 4),
    ('Alex', 'Marketing Lead', 3);
```

The CEO has `manager_id = NULL` — they report to nobody. Everyone else
points to another row in the same table.

```sql
SELECT
    e.name AS employee,
    e.title,
    m.name AS manager
FROM employees e
LEFT JOIN employees m ON m.id = e.manager_id
ORDER BY e.id;
```

The `LEFT JOIN` ensures the CEO (with no manager) still appears. A
regular `JOIN` would silently drop anyone without a manager.

For finding an entire hierarchy (all reports under a manager, recursively),
you need a recursive CTE:

```sql
WITH RECURSIVE org_chart AS (
    SELECT id, name, title, manager_id, 0 AS depth
    FROM employees
    WHERE manager_id IS NULL

    UNION ALL

    SELECT e.id, e.name, e.title, e.manager_id, oc.depth + 1
    FROM employees e
    JOIN org_chart oc ON oc.id = e.manager_id
)
SELECT repeat('  ', depth) || name AS org_line, title
FROM org_chart
ORDER BY depth, name;
```

---

## Polymorphic Associations

Comments can be on posts. Comments can also be on photos. The comment
table needs to point to different parent tables depending on the
context. This is called a polymorphic association.

### Approach 1: Separate Foreign Keys (Recommended)

```sql
CREATE TABLE photos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE comments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    post_id BIGINT REFERENCES posts(id),
    photo_id BIGINT REFERENCES photos(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT comment_has_one_parent CHECK (
        (post_id IS NOT NULL AND photo_id IS NULL) OR
        (post_id IS NULL AND photo_id IS NOT NULL)
    )
);
```

The `CHECK` constraint ensures every comment belongs to exactly one
parent — either a post or a photo, never both, never neither. The
database enforces your business rule.

**Tradeoff:** This works well with 2-3 parent types. If you have 10
commentable types, the table gets wide with many nullable foreign keys.

### Approach 2: Type + ID Columns (Use With Caution)

```sql
CREATE TABLE comments_poly (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    commentable_type TEXT NOT NULL,
    commentable_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comments_poly_target
    ON comments_poly(commentable_type, commentable_id);
```

This pattern comes from Rails (ActiveRecord). `commentable_type` stores
`'Post'` or `'Photo'`, and `commentable_id` stores the ID of that
record.

**Warning:** You lose foreign key enforcement. The database cannot verify
that `commentable_id = 42` actually exists in the `posts` table when
`commentable_type = 'Post'`. You're relying entirely on application code
to maintain referential integrity. Data will drift over time.

### Approach 3: Separate Comment Tables (Most Normalized)

```sql
CREATE TABLE post_comments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    post_id BIGINT NOT NULL REFERENCES posts(id),
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE photo_comments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    photo_id BIGINT NOT NULL REFERENCES photos(id),
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Full referential integrity. But if you need "all comments by a user" you
need a `UNION ALL` across tables. Querying gets more complex as the
number of commentable types grows.

---

## Single Table Inheritance vs Separate Tables

You have different types of notifications: email notifications, push
notifications, SMS notifications. They share some fields but each has
unique ones. How do you model this?

### Single Table Inheritance (STI)

All types in one table, with a `type` column:

```sql
CREATE TABLE notifications (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    email_address TEXT,
    device_token TEXT,
    phone_number TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Analogy:** A single filing cabinet drawer with divider tabs. All
notifications are in one place, and you use the tab (type column) to
find what you want.

**Pros:** Simple queries, one table to manage, easy to find "all
notifications for user X."

**Cons:** Many nullable columns. An email notification has `device_token`
and `phone_number` as NULL. The table is wide and sparse. The database
can't enforce that an email notification must have an `email_address`.

### Separate Tables

```sql
CREATE TABLE email_notifications (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    message TEXT NOT NULL,
    email_address TEXT NOT NULL,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE push_notifications (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    message TEXT NOT NULL,
    device_token TEXT NOT NULL,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Pros:** No nullable columns, database enforces required fields per
type, each table is lean.

**Cons:** "All notifications for a user" requires `UNION ALL`. Adding
shared behavior means changing multiple tables.

**Rule of thumb:** If your types share 80%+ of their columns, use STI.
If they're mostly different with a few shared fields, use separate
tables.

---

## EAV: Entity-Attribute-Value (And Why It's Usually Bad)

EAV is a pattern where instead of columns, you store attributes as rows:

```sql
CREATE TABLE product_attributes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id BIGINT NOT NULL,
    attribute_name TEXT NOT NULL,
    attribute_value TEXT NOT NULL
);

INSERT INTO product_attributes (product_id, attribute_name, attribute_value) VALUES
    (1, 'color', 'red'),
    (1, 'size', 'large'),
    (1, 'weight', '2.5'),
    (2, 'color', 'blue'),
    (2, 'material', 'cotton');
```

**Analogy:** Instead of a spreadsheet with named columns, you have a
notebook where each line says "Product 1's color is red." Retrieving
all of Product 1's attributes means reading every line in the notebook
that mentions Product 1.

### Why It's Bad

**1. Queries are awful.** Finding all red, large products:

```sql
SELECT p.product_id
FROM product_attributes p
WHERE p.attribute_name = 'color' AND p.attribute_value = 'red'
INTERSECT
SELECT p.product_id
FROM product_attributes p
WHERE p.attribute_name = 'size' AND p.attribute_value = 'large';
```

Compare to a proper schema: `SELECT id FROM products WHERE color = 'red'
AND size = 'large';`

**2. No type safety.** `weight` is stored as a string. Is `'2.5'`
kilograms? Pounds? The database has no idea. You can't do
`WHERE weight > 2.0` without casting and praying.

**3. No constraints.** You can't say "color is required" or "weight
must be positive." Every attribute is just a string in a row.

**4. Performance is terrible.** Each attribute lookup is a separate row.
Reconstructing a full product requires pivoting many rows into columns.

### When It's Acceptable

EAV is appropriate only when attributes are truly dynamic and
user-defined — like a form builder where users create custom fields.
Even then, PostgreSQL's JSONB (covered in Lesson 18) is usually a
better option.

---

## Soft Deletes vs Hard Deletes

### Hard Delete

```sql
DELETE FROM posts WHERE id = 42;
```

The row is gone. If you need it back, restore from a backup.

### Soft Delete

```sql
ALTER TABLE posts ADD COLUMN deleted_at TIMESTAMPTZ;

UPDATE posts SET deleted_at = NOW() WHERE id = 42;
```

The row is still there, marked as deleted. Your queries filter it out:

```sql
SELECT * FROM posts WHERE deleted_at IS NULL;
```

**Analogy:** Hard delete is shredding a document. Soft delete is moving
it to the "Trash" folder. It's out of sight but recoverable.

### Creating a View for Convenience

```sql
CREATE VIEW active_posts AS
SELECT * FROM posts WHERE deleted_at IS NULL;

SELECT * FROM active_posts;
```

### Tradeoffs

| | Hard Delete | Soft Delete |
|---|---|---|
| Recovery | Need a backup | Just clear `deleted_at` |
| Table size | Stays lean | Grows indefinitely |
| Query complexity | Simple | Every query needs `WHERE deleted_at IS NULL` |
| Foreign keys | Cascade delete handles cleanup | Orphaned references possible |
| Compliance | Data is gone (GDPR-friendly) | Data persists (GDPR concern) |
| Indexes | Smaller, faster | Partial index helps |

If you use soft deletes, always add a partial index:

```sql
CREATE INDEX idx_posts_active ON posts(id) WHERE deleted_at IS NULL;
```

This index covers only active rows, keeping it small and fast.

---

## Audit Trails

Almost every production table needs to know when a row was created,
when it was last changed, and by whom.

```sql
CREATE TABLE articles (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by BIGINT NOT NULL REFERENCES users(id),
    updated_by BIGINT NOT NULL REFERENCES users(id)
);
```

### Auto-Updating `updated_at`

Postgres doesn't auto-update timestamps. You need a trigger:

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON articles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
```

Now every `UPDATE` on `articles` automatically refreshes `updated_at`.

### Full History Table

If you need a complete audit log (who changed what, when, and what the
old value was):

```sql
CREATE TABLE article_history (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    article_id BIGINT NOT NULL REFERENCES articles(id),
    changed_by BIGINT NOT NULL REFERENCES users(id),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT
);
```

---

## UUIDs vs Auto-Increment IDs

### Auto-Increment (IDENTITY / SERIAL)

```sql
CREATE TABLE items_serial (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL
);
```

IDs are sequential: 1, 2, 3, 4... Simple, compact, fast.

### UUIDs

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE items_uuid (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL
);

INSERT INTO items_uuid (name) VALUES ('Widget');
SELECT * FROM items_uuid;
```

IDs look like: `a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11`

### Tradeoffs

| | Auto-Increment | UUID |
|---|---|---|
| Size | 8 bytes (BIGINT) | 16 bytes |
| Index performance | Excellent (sequential) | Worse (random, causes page splits) |
| Guessability | Easy (id=1, id=2...) | Practically impossible |
| Distributed generation | Needs coordination | Generate anywhere, no conflicts |
| URL exposure | Reveals record count | Reveals nothing |
| Merge/replication | ID conflicts possible | No conflicts |

**Analogy:** Auto-increment is like a ticket counter at a deli — simple
numbered tickets, but everyone can see how many customers you've had.
UUIDs are like random lottery ticket numbers — no sequence, no
information leakage, but they take up more space.

**Practical guidance:**
- Internal-only IDs (never exposed in URLs/APIs): auto-increment
- Public-facing IDs (URLs, APIs, mobile clients): UUID or a public slug
  alongside an internal auto-increment
- Distributed systems (multiple write nodes): UUID

Many applications use both — an internal auto-increment `id` for joins
and an external `public_id UUID` for APIs.

---

## Slug Patterns for URLs

Slugs are URL-friendly identifiers derived from a title or name.

```sql
CREATE TABLE blog_posts (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO blog_posts (title, slug, body) VALUES
    ('My First Post', 'my-first-post', 'Content here...'),
    ('PostgreSQL Tips & Tricks', 'postgresql-tips-and-tricks', 'Content...');

SELECT * FROM blog_posts WHERE slug = 'my-first-post';
```

**URL:** `https://myblog.com/posts/my-first-post` is readable and
SEO-friendly, compared to `https://myblog.com/posts/47`.

### Handling Duplicate Slugs

If two posts have the same title, you need unique slugs:

```sql
INSERT INTO blog_posts (title, slug, body) VALUES
    ('My First Post', 'my-first-post-2', 'Different content...');
```

Your application layer typically handles slug generation — convert to
lowercase, replace spaces with hyphens, strip special characters, append
a number if duplicate.

### Slug + ID Hybrid

Some applications use both for robustness:

URL: `/posts/47-my-first-post`

The application parses out the numeric ID and ignores the slug portion.
This way, even if the title changes and the slug updates, old links with
the wrong slug still work because the ID is what matters.

---

## Status / State Machines in the Database

Many entities have a lifecycle: an order goes from `pending` to
`confirmed` to `shipped` to `delivered`. This is a state machine.

```sql
CREATE TYPE order_status AS ENUM (
    'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'
);

CREATE TABLE orders (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    status order_status NOT NULL DEFAULT 'pending',
    total_cents BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_status ON orders(status);
```

Using an `ENUM` type means Postgres rejects invalid statuses at the
database level:

```sql
INSERT INTO orders (user_id, status, total_cents)
VALUES (1, 'flying', 5000);
-- ERROR: invalid input value for enum order_status: "flying"
```

### Tracking State Transitions

For audit purposes, track every status change:

```sql
CREATE TABLE order_status_history (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id),
    from_status order_status,
    to_status order_status NOT NULL,
    changed_by BIGINT REFERENCES users(id),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason TEXT
);
```

### Enforcing Valid Transitions

Not every transition is legal. You can't go from `delivered` back to
`pending`. A `CHECK` constraint or trigger can enforce this:

```sql
CREATE OR REPLACE FUNCTION enforce_order_transition()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'cancelled' THEN
        RAISE EXCEPTION 'Cannot transition from cancelled';
    END IF;

    IF OLD.status = 'delivered' AND NEW.status != 'delivered' THEN
        RAISE EXCEPTION 'Cannot transition from delivered';
    END IF;

    INSERT INTO order_status_history (order_id, from_status, to_status)
    VALUES (NEW.id, OLD.status, NEW.status);

    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER order_status_transition
    BEFORE UPDATE OF status ON orders
    FOR EACH ROW
    EXECUTE FUNCTION enforce_order_transition();
```

---

## Practical: Design a Blog Platform Schema

Let's put everything together. A blog needs users, posts, comments, tags,
and likes.

```sql
-- Clean slate
DROP TABLE IF EXISTS blog_likes, blog_post_tags, blog_tags,
    blog_comments, blog_posts, blog_users CASCADE;

-- Users
CREATE TABLE blog_users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    bio TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Posts (one-to-many with users, soft delete, slugs, state machine)
CREATE TYPE post_status AS ENUM ('draft', 'published', 'archived');

CREATE TABLE blog_posts (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES blog_users(id),
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    body TEXT NOT NULL,
    status post_status NOT NULL DEFAULT 'draft',
    published_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_blog_posts_user_id ON blog_posts(user_id);
CREATE INDEX idx_blog_posts_slug ON blog_posts(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_blog_posts_status ON blog_posts(status) WHERE deleted_at IS NULL;

-- Comments (one-to-many with posts, self-referential for replies)
CREATE TABLE blog_comments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES blog_posts(id),
    user_id BIGINT NOT NULL REFERENCES blog_users(id),
    parent_comment_id BIGINT REFERENCES blog_comments(id),
    body TEXT NOT NULL,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_blog_comments_post_id ON blog_comments(post_id);
CREATE INDEX idx_blog_comments_user_id ON blog_comments(user_id);
CREATE INDEX idx_blog_comments_parent ON blog_comments(parent_comment_id);

-- Tags (many-to-many with posts via junction table)
CREATE TABLE blog_tags (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE
);

CREATE TABLE blog_post_tags (
    post_id BIGINT NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
    tag_id BIGINT NOT NULL REFERENCES blog_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, tag_id)
);

CREATE INDEX idx_blog_post_tags_tag_id ON blog_post_tags(tag_id);

-- Likes (many-to-many between users and posts, unique constraint)
CREATE TABLE blog_likes (
    user_id BIGINT NOT NULL REFERENCES blog_users(id),
    post_id BIGINT NOT NULL REFERENCES blog_posts(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, post_id)
);

CREATE INDEX idx_blog_likes_post_id ON blog_likes(post_id);
```

### Seed Data

```sql
INSERT INTO blog_users (username, email, display_name, bio) VALUES
    ('alice', 'alice@example.com', 'Alice Chen', 'Backend engineer'),
    ('bob', 'bob@example.com', 'Bob Smith', 'Full-stack dev'),
    ('carol', 'carol@example.com', 'Carol Davis', 'Database enthusiast');

INSERT INTO blog_posts (user_id, title, slug, body, status, published_at) VALUES
    (1, 'Getting Started with SQL', 'getting-started-with-sql',
     'SQL is the language of databases...', 'published', NOW()),
    (1, 'Advanced Joins', 'advanced-joins',
     'Let us explore join strategies...', 'published', NOW()),
    (2, 'My Draft Post', 'my-draft-post',
     'Work in progress...', 'draft', NULL),
    (3, 'PostgreSQL Tips', 'postgresql-tips',
     'Here are my favorite features...', 'published', NOW());

INSERT INTO blog_tags (name, slug) VALUES
    ('SQL', 'sql'), ('PostgreSQL', 'postgresql'),
    ('Tutorial', 'tutorial'), ('Advanced', 'advanced');

INSERT INTO blog_post_tags (post_id, tag_id) VALUES
    (1, 1), (1, 3),
    (2, 1), (2, 4),
    (4, 2), (4, 3);

INSERT INTO blog_comments (post_id, user_id, body) VALUES
    (1, 2, 'Great introduction!'),
    (1, 3, 'Very helpful, thanks!');

INSERT INTO blog_comments (post_id, user_id, parent_comment_id, body) VALUES
    (1, 1, 1, 'Thanks Bob!');

INSERT INTO blog_likes (user_id, post_id) VALUES
    (2, 1), (3, 1), (1, 4), (2, 4);
```

### Useful Queries

```sql
-- Published posts with author and tag count
SELECT
    p.title,
    u.display_name AS author,
    COUNT(DISTINCT pt.tag_id) AS tag_count,
    COUNT(DISTINCT l.user_id) AS like_count,
    COUNT(DISTINCT c.id) AS comment_count
FROM blog_posts p
JOIN blog_users u ON u.id = p.user_id
LEFT JOIN blog_post_tags pt ON pt.post_id = p.id
LEFT JOIN blog_likes l ON l.post_id = p.id
LEFT JOIN blog_comments c ON c.post_id = p.id AND c.deleted_at IS NULL
WHERE p.status = 'published' AND p.deleted_at IS NULL
GROUP BY p.id, p.title, u.display_name
ORDER BY like_count DESC;

-- All tags for a specific post
SELECT t.name
FROM blog_tags t
JOIN blog_post_tags pt ON pt.tag_id = t.id
WHERE pt.post_id = 1;

-- Comment thread with replies (one level deep)
SELECT
    c.id,
    c.body,
    u.display_name AS commenter,
    c.parent_comment_id,
    c.created_at
FROM blog_comments c
JOIN blog_users u ON u.id = c.user_id
WHERE c.post_id = 1 AND c.deleted_at IS NULL
ORDER BY COALESCE(c.parent_comment_id, c.id), c.created_at;
```

---

## Exercises

### Exercise 1: Extend the Blog Schema

Add a `bookmarks` feature — users can bookmark posts. Design the table
with appropriate constraints and indexes. Write queries to:
- Bookmark a post
- List a user's bookmarks with post titles, ordered by most recently bookmarked
- Count how many users bookmarked each post

### Exercise 2: Categories With Hierarchy

Add a `blog_categories` table that supports nested categories (a category
can have a parent category). Assign each post to one category. Write a
recursive CTE that lists all posts in a category and its subcategories.

### Exercise 3: Soft Delete Cascade

When a post is soft-deleted (`deleted_at` is set), its comments should
also be soft-deleted. Write a trigger that handles this. Then write a
function that "restores" a post and all its comments.

### Exercise 4: State Machine

Add status tracking to blog posts. Create a `blog_post_status_history`
table and a trigger that records every status change. Enforce that a
post can only go `draft -> published -> archived` (no skipping steps,
no going backwards except `archived -> draft`).

### Exercise 5: EAV vs JSONB

Create a `product_attributes` EAV table and a `products_jsonb` table
that stores attributes as JSONB. Insert 5 products with 4 attributes
each. Write a query to find products where `color = 'red' AND size = 'large'`
using both approaches. Compare the query complexity.

---

## Key Takeaways

1. **One-to-many:** foreign key on the "many" side. Always index it.
2. **Many-to-many:** junction table with composite primary key.
3. **Self-referential:** a table's foreign key points to its own primary key. Use recursive CTEs for trees.
4. **Polymorphic associations:** prefer separate FKs with a CHECK constraint over type+id columns.
5. **STI vs separate tables:** depends on how much the types share.
6. **EAV is almost always wrong.** Use JSONB or proper columns instead.
7. **Soft deletes** keep data recoverable but add query complexity.
8. **Audit columns** (`created_at`, `updated_at`, `created_by`) belong on every table.
9. **UUIDs for public-facing IDs**, auto-increment for internal use.
10. **Slugs** make URLs human-readable.
11. **ENUM + history table** for state machines with audit trails.

Next: [Lesson 17 — Migrations: Evolving Your Schema Safely](./17-migrations.md)
