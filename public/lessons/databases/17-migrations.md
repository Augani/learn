# Lesson 17: Migrations — Evolving Your Schema Safely

Your application is running in production. Users are creating data.
Now you need to add a feature that requires a new column, a new table,
or a changed constraint. You can't just drop the database and recreate
it — there's real data in there.

Migrations are how you evolve a database schema over time, safely and
reproducibly.

---

## What Migrations Are

A migration is a versioned, ordered script that changes your database
schema. Each migration has a timestamp or sequence number, and they run
in order.

**Analogy: Git commits for your database structure.**

Your application code evolves through git commits. Each commit is a
snapshot of changes, ordered in time, and you can see the full history.
Migrations work the same way but for your database. Just as you'd never
edit a file on the production server directly — you commit code, push,
and deploy — you never edit a production schema by hand. You write a
migration, review it, and apply it through a controlled process.

```
Migration 001: Create users table
Migration 002: Create posts table
Migration 003: Add email column to users
Migration 004: Create comments table
Migration 005: Add index on posts.user_id
```

When you deploy to a new environment, the migration tool runs all
migrations in order, from 001 to 005, and you get the correct schema.
When you deploy an update, it sees that 001-003 have already run and
only applies 004 and 005.

---

## Up and Down Migrations

Every migration has two parts:

- **Up (forward):** Apply the change — add a column, create a table, etc.
- **Down (rollback):** Undo the change — remove the column, drop the table, etc.

```sql
-- Migration 003: Add email column to users

-- UP
ALTER TABLE users ADD COLUMN email TEXT;

-- DOWN
ALTER TABLE users DROP COLUMN email;
```

**Analogy:** Think of it like a recipe that also includes un-cooking
instructions. "Step 3: Add salt. To undo: ... well, you can't really
un-add salt." And that's the catch — not every migration is perfectly
reversible.

### When Down Migrations Don't Work

```sql
-- UP: Drop the legacy_field column
ALTER TABLE users DROP COLUMN legacy_field;

-- DOWN: Add it back... but the DATA is gone
ALTER TABLE users ADD COLUMN legacy_field TEXT;
```

You can recreate the column, but the data that was in it is lost forever.
This is why many teams treat down migrations as best-effort. Some teams
skip them entirely and rely on restoring from backups if a rollback is
needed.

---

## Why You Never Modify Production Schemas by Hand

Imagine you SSH into your production database and run:

```sql
ALTER TABLE users ADD COLUMN phone TEXT;
```

Now:

1. Your staging database doesn't have this column.
2. Your development database doesn't have this column.
3. Your migration files don't know about this column.
4. The next developer who sets up the project from scratch won't have it.
5. If you need to recreate the production database, this change is lost.

**Analogy:** It's like editing a file directly on the production server
instead of going through git. Maybe it works today. But you've created
invisible drift between what your code expects and what actually exists
in every other environment.

Every schema change goes through a migration file, committed to version
control, reviewed in a PR, applied through a deployment pipeline.

---

## Common Migration Operations

### Adding a Table

```sql
-- UP
CREATE TABLE tags (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- DOWN
DROP TABLE tags;
```

Safe. No existing data is affected.

### Adding a Column

```sql
-- UP
ALTER TABLE users ADD COLUMN bio TEXT;

-- DOWN
ALTER TABLE users DROP COLUMN bio;
```

Safe if the column is nullable or has a default. Dangerous if
`NOT NULL` without a default (existing rows would violate the
constraint).

### Adding a Column With a Default (Safe)

```sql
-- UP
ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;

-- DOWN
ALTER TABLE users DROP COLUMN is_active;
```

In PostgreSQL 11+, adding a column with a non-volatile default is
instant — Postgres stores the default in the catalog and applies it
lazily. No table rewrite required.

### Removing a Column

```sql
-- UP
ALTER TABLE users DROP COLUMN legacy_nickname;

-- DOWN
ALTER TABLE users ADD COLUMN legacy_nickname TEXT;
```

**Dangerous.** The data in that column is gone permanently. Always
ensure no code references this column before dropping it.

### Renaming a Column

```sql
-- UP
ALTER TABLE users RENAME COLUMN name TO full_name;

-- DOWN
ALTER TABLE users RENAME COLUMN full_name TO name;
```

**Dangerous in production.** The moment this migration runs, any
application code still referencing `name` will break. You need to
coordinate the code deploy and migration carefully.

### Adding an Index

```sql
-- UP
CREATE INDEX CONCURRENTLY idx_posts_created_at ON posts(created_at);

-- DOWN
DROP INDEX idx_posts_created_at;
```

Always use `CONCURRENTLY` for indexes on production tables. Without it,
Postgres locks the entire table for writes until the index is built.
On a table with millions of rows, that could be minutes of downtime.

**Note:** `CREATE INDEX CONCURRENTLY` cannot run inside a transaction.
Most migration tools have a way to mark a migration as
"no-transaction" for this reason.

### Adding a Foreign Key

```sql
-- UP
ALTER TABLE posts
    ADD CONSTRAINT fk_posts_user_id
    FOREIGN KEY (user_id) REFERENCES users(id);

-- DOWN
ALTER TABLE posts DROP CONSTRAINT fk_posts_user_id;
```

On large tables, this acquires a lock while it validates all existing
rows. Use `NOT VALID` to add the constraint without validating, then
validate separately:

```sql
-- Step 1: Add without validating (instant, brief lock)
ALTER TABLE posts
    ADD CONSTRAINT fk_posts_user_id
    FOREIGN KEY (user_id) REFERENCES users(id)
    NOT VALID;

-- Step 2: Validate existing rows (no lock on writes)
ALTER TABLE posts VALIDATE CONSTRAINT fk_posts_user_id;
```

### Changing a Column Type

```sql
-- UP
ALTER TABLE products ALTER COLUMN price TYPE NUMERIC(10,2);

-- DOWN
ALTER TABLE products ALTER COLUMN price TYPE INTEGER;
```

**Dangerous.** This rewrites the entire table. On a table with 100
million rows, that could take hours and lock the table the entire time.

---

## Safe vs Dangerous Migrations

### Safe Migrations (Do Freely)

| Operation | Why It's Safe |
|---|---|
| Create a new table | No existing data affected |
| Add a nullable column | Existing rows get NULL |
| Add a column with a default | Instant in Postgres 11+ |
| Create an index `CONCURRENTLY` | No write locks |
| Add a constraint with `NOT VALID` | Instant, validates later |

### Dangerous Migrations (Extra Caution)

| Operation | Why It's Dangerous |
|---|---|
| Drop a column | Data loss, code may reference it |
| Rename a column | Breaks code referencing old name |
| Change a column type | Table rewrite, long lock |
| Add `NOT NULL` to existing column | Fails if any NULLs exist |
| Drop a table | Data loss |
| Remove a default | New inserts may fail |

---

## The Safe Way to Remove a Column

You don't just drop a column. You do it in phases across multiple
deploys:

```
Deploy 1: Stop writing to the column
  - Update application code to not reference the column
  - Deploy the code change

Deploy 2: Drop the column
  - Write a migration that drops the column
  - Deploy
```

If you drop the column first, the currently-running application code
(which still references it) will start throwing errors in the gap
between the migration running and the new code deploying.

**For renaming a column, the safe approach:**

```
Deploy 1: Add the new column, write to both
  Migration: ALTER TABLE users ADD COLUMN full_name TEXT;
  Code: Write to both `name` and `full_name`

Deploy 2: Backfill, switch reads to new column
  Migration: UPDATE users SET full_name = name WHERE full_name IS NULL;
  Code: Read from `full_name`, still write to both

Deploy 3: Stop writing to old column
  Code: Only read/write `full_name`

Deploy 4: Drop the old column
  Migration: ALTER TABLE users DROP COLUMN name;
```

This is four deploys for a rename. That's the cost of zero-downtime
schema changes in production. It's tedious, but necessary when you have
thousands of users and can't afford any errors.

---

## Backfilling Data

When you add a new column and need to populate it for existing rows:

```sql
-- Migration: Add the column
ALTER TABLE users ADD COLUMN username_lower TEXT;

-- Backfill in batches (don't update millions of rows at once)
UPDATE users SET username_lower = LOWER(username)
WHERE id BETWEEN 1 AND 10000;

UPDATE users SET username_lower = LOWER(username)
WHERE id BETWEEN 10001 AND 20000;

-- ... continue until all rows are updated

-- Then add the NOT NULL constraint
ALTER TABLE users ALTER COLUMN username_lower SET NOT NULL;
```

**Why batch?** Updating 10 million rows in a single `UPDATE` holds a
lock, generates massive WAL, and can exhaust memory. Batching in chunks
of 10,000 keeps the impact manageable.

**Analogy:** You don't paint an entire house in one stroke. You do it
room by room, letting each room dry before moving on. Batched updates
work the same way — process a chunk, let the database breathe, process
the next chunk.

---

## Zero-Downtime Migration Strategy

The core principle: **the database schema must be compatible with both
the old and new versions of your application at all times.**

```
                    Old Code Running
                         │
  Migration runs ────────┤
                         │
                    Old Code Still Works
                         │
  New Code deploys ──────┤
                         │
                    New Code Running
```

This means:

1. **Adding a column?** Old code ignores it (it doesn't `SELECT *`, right?).
2. **Removing a column?** Remove it from the code first, then drop it.
3. **Renaming a column?** Add new, migrate data, switch code, drop old.
4. **Changing a type?** Add a new column with the new type, migrate data, switch, drop old.

The pattern is always: **expand, migrate, contract.**

- **Expand:** Add the new structure alongside the old.
- **Migrate:** Copy/transform data from old to new.
- **Contract:** Remove the old structure once nothing uses it.

---

## Migration Tools

### Rust: sqlx migrate

```
migrations/
  20240115120000_create_users.sql
  20240116090000_create_posts.sql
  20240117140000_add_email_to_users.sql
```

Each file is a plain SQL file with a timestamp prefix. To apply:

```bash
sqlx migrate run --database-url postgres://localhost/learn_db
```

Reversible migrations use `.up.sql` and `.down.sql` suffixes:

```
migrations/
  20240115120000_create_users.up.sql
  20240115120000_create_users.down.sql
```

sqlx tracks which migrations have run in a `_sqlx_migrations` table.

### Go: golang-migrate

```
migrations/
  000001_create_users.up.sql
  000001_create_users.down.sql
  000002_create_posts.up.sql
  000002_create_posts.down.sql
```

```bash
migrate -path migrations -database "postgres://localhost/learn_db" up
migrate -path migrations -database "postgres://localhost/learn_db" down 1
```

### TypeScript: Prisma Migrate

Prisma uses a declarative approach — you describe the desired state in
a schema file, and Prisma generates the migration SQL:

```prisma
model User {
  id    Int     @id @default(autoincrement())
  email String  @unique
  name  String?
  posts Post[]
}

model Post {
  id       Int    @id @default(autoincrement())
  title    String
  author   User   @relation(fields: [authorId], references: [id])
  authorId Int
}
```

```bash
npx prisma migrate dev --name add_email_to_users
```

Prisma generates the SQL, stores it in a `migrations` folder, and
applies it.

### Raw SQL Approach

You can manage migrations manually with a tracking table:

```sql
CREATE TABLE schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Before running a migration, check if it's been applied
SELECT version FROM schema_migrations WHERE version = '003';

-- After running a migration, record it
INSERT INTO schema_migrations (version) VALUES ('003');
```

This is what migration tools do under the hood — a table that tracks
what's been run.

---

## Example Migration Sequence: Adding a "Likes" Feature

Let's walk through a real feature from start to finish.

**Feature:** Users can like posts. Display like counts on posts.

### Migration 1: Create the likes table

```sql
-- 20240301_create_likes.up.sql

CREATE TABLE likes (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, post_id)
);

CREATE INDEX idx_likes_post_id ON likes(post_id);
```

```sql
-- 20240301_create_likes.down.sql

DROP TABLE likes;
```

### Migration 2: Add a cached like count to posts

Computing `COUNT(*)` from the likes table on every page load is
expensive. We add a denormalized count column:

```sql
-- 20240302_add_like_count_to_posts.up.sql

ALTER TABLE posts ADD COLUMN like_count INTEGER NOT NULL DEFAULT 0;
```

```sql
-- 20240302_add_like_count_to_posts.down.sql

ALTER TABLE posts DROP COLUMN like_count;
```

### Migration 3: Backfill existing like counts

```sql
-- 20240303_backfill_like_counts.up.sql

UPDATE posts p
SET like_count = (
    SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id
);
```

```sql
-- 20240303_backfill_like_counts.down.sql

UPDATE posts SET like_count = 0;
```

### Migration 4: Add a trigger to keep counts in sync

```sql
-- 20240304_add_like_count_trigger.up.sql

CREATE OR REPLACE FUNCTION update_post_like_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE posts SET like_count = like_count + 1
        WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE posts SET like_count = like_count - 1
        WHERE id = OLD.post_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_like_count
    AFTER INSERT OR DELETE ON likes
    FOR EACH ROW
    EXECUTE FUNCTION update_post_like_count();
```

```sql
-- 20240304_add_like_count_trigger.down.sql

DROP TRIGGER trigger_update_like_count ON likes;
DROP FUNCTION update_post_like_count;
```

Notice how the feature is split into four focused migrations, each doing
one thing. They can be reviewed independently, and if migration 4 has a
bug, you can roll back just that one without losing the table or data
from migrations 1-3.

---

## Migration Best Practices

**1. One migration, one concern.** Don't create a table AND add an
unrelated column in the same migration. Keep them separate.

**2. Migrations are immutable.** Once a migration has been applied to
any shared environment (staging, production), never edit it. Write a
new migration to fix issues.

**3. Test migrations on a copy.** Before applying to production, run
them against a recent copy of the production database. This catches
data-dependent issues (like adding `NOT NULL` when NULLs exist).

**4. Time your migrations.** Run `\timing` in psql before applying
migrations manually. If a migration takes 30 seconds on a staging
database with 10% of production data, it'll take 5+ minutes on
production.

**5. Have a rollback plan.** Know the down migration. Have a database
backup. Know who to call at 2 AM.

**6. Use transactions for DDL.** PostgreSQL supports transactional DDL,
meaning `CREATE TABLE`, `ALTER TABLE`, etc. can be inside a transaction.
If the migration fails halfway, everything rolls back cleanly:

```sql
BEGIN;
  ALTER TABLE users ADD COLUMN bio TEXT;
  ALTER TABLE users ADD COLUMN avatar_url TEXT;
  CREATE INDEX idx_users_bio ON users(bio);
COMMIT;
```

If any statement fails, none of them apply. (Exception: `CREATE INDEX
CONCURRENTLY` cannot be in a transaction.)

---

## Practical: Write a Migration Sequence

Let's simulate writing migrations by hand in PostgreSQL.

```sql
-- Set up a migration tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Helper function to run and record a migration
-- (In practice, your migration tool does this)

-- Migration 001: Create users
CREATE TABLE users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO schema_migrations (version, name) VALUES ('001', 'create_users');

-- Migration 002: Create posts
CREATE TABLE posts (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_posts_user_id ON posts(user_id);
INSERT INTO schema_migrations (version, name) VALUES ('002', 'create_posts');

-- Migration 003: Add bio to users
ALTER TABLE users ADD COLUMN bio TEXT;
INSERT INTO schema_migrations (version, name) VALUES ('003', 'add_bio_to_users');

-- Migration 004: Add published_at to posts
ALTER TABLE posts ADD COLUMN published_at TIMESTAMPTZ;
CREATE INDEX idx_posts_published_at ON posts(published_at)
    WHERE published_at IS NOT NULL;
INSERT INTO schema_migrations (version, name) VALUES ('004', 'add_published_at_to_posts');

-- Verify migration history
SELECT version, name, applied_at FROM schema_migrations ORDER BY version;

-- Verify final schema
\d users
\d posts
```

---

## Exercises

### Exercise 1: Write a Migration to Add Comments

Write the up and down SQL for adding a `comments` table that references
both `users` and `posts`. Include appropriate indexes. Apply it and
record it in `schema_migrations`.

### Exercise 2: Safe Column Rename

You need to rename `users.username` to `users.handle`. Write the full
sequence of migrations needed for a zero-downtime rename (expand,
migrate, contract). Apply each migration, inserting into
`schema_migrations` at each step.

### Exercise 3: Add NOT NULL Safely

The `users.bio` column is nullable but you want to make it required.
Write a migration sequence that:
1. Sets a default for existing NULL values
2. Adds the NOT NULL constraint
3. Handles the case where some rows might have NULL

### Exercise 4: Concurrent Index Creation

Create a `tags` table with 100,000 rows. Then write a migration that
adds an index `CONCURRENTLY`. Time both `CREATE INDEX` and `CREATE INDEX
CONCURRENTLY` to see the difference:

```sql
\timing
CREATE INDEX idx_tags_name ON tags(name);
DROP INDEX idx_tags_name;
CREATE INDEX CONCURRENTLY idx_tags_name ON tags(name);
```

### Exercise 5: Migration Rollback

Apply migrations 001-004 from the practical section above. Then "roll
back" migration 004 by undoing it manually and removing the entry from
`schema_migrations`. Verify the schema matches what it looked like
after migration 003.

---

## Key Takeaways

1. **Migrations are version-controlled schema changes.** Every change is a file, reviewed, and applied in order.
2. **Never modify production schemas by hand.** Always go through migrations.
3. **Up and down** — every migration should be reversible when possible.
4. **Safe operations** add things. **Dangerous operations** remove or change things.
5. **Use `CONCURRENTLY`** for indexes on production tables.
6. **Expand, migrate, contract** — the pattern for zero-downtime changes.
7. **Batch backfills.** Don't update millions of rows in one statement.
8. **Migrations are immutable.** Never edit a migration that's been applied elsewhere.
9. **Test on a copy** of production data before applying to production.
10. **PostgreSQL supports transactional DDL** — use it for atomic migrations.

Next: [Lesson 18 — PostgreSQL Superpowers: JSONB, Arrays, Full-Text Search](./18-postgres-features.md)
