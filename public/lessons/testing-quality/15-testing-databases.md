# Lesson 15: Testing Database Code

> **The one thing to remember**: Testing database code means testing
> that your SQL queries, your data models, and your database actually
> work together. It's like testing a filing system — you need to actually
> file and retrieve documents to know the system works, not just check
> that the filing cabinet exists.

---

## The Filing Cabinet Analogy

```
UNIT TEST (mocking the database):
  "I'll pretend the filing cabinet works and test
   my logic for organizing files."
  → Useful for testing business rules
  → Doesn't catch: wrong drawer labels, stuck drawers

INTEGRATION TEST (real database):
  "I'll actually put files in the cabinet and pull
   them back out."
  → Catches real database problems
  → SQL errors, wrong column names, constraint violations

You need BOTH, but integration tests are essential for database code.
```

---

## Strategy 1: In-Memory Database

The fastest approach. Use SQLite in-memory or H2 for quick tests.

```python
import sqlite3
import pytest

class ArticleRepository:
    def __init__(self, conn):
        self.conn = conn
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS articles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                body TEXT NOT NULL,
                author TEXT NOT NULL,
                published BOOLEAN DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

    def create(self, title, body, author):
        cursor = self.conn.execute(
            "INSERT INTO articles (title, body, author) VALUES (?, ?, ?)",
            (title, body, author)
        )
        self.conn.commit()
        return cursor.lastrowid

    def find_published(self):
        rows = self.conn.execute(
            "SELECT id, title, author FROM articles WHERE published = 1 ORDER BY created_at DESC"
        ).fetchall()
        return [{"id": r[0], "title": r[1], "author": r[2]} for r in rows]

    def publish(self, article_id):
        self.conn.execute(
            "UPDATE articles SET published = 1 WHERE id = ?", (article_id,)
        )
        self.conn.commit()

@pytest.fixture
def repo():
    conn = sqlite3.connect(":memory:")
    repository = ArticleRepository(conn)
    yield repository
    conn.close()

def test_create_and_find(repo):
    article_id = repo.create("TDD Guide", "Content here...", "Alice")

    repo.publish(article_id)

    published = repo.find_published()
    assert len(published) == 1
    assert published[0]["title"] == "TDD Guide"
    assert published[0]["author"] == "Alice"

def test_unpublished_not_returned(repo):
    repo.create("Draft Article", "Not ready yet", "Bob")

    published = repo.find_published()
    assert len(published) == 0

def test_multiple_published_ordered(repo):
    id1 = repo.create("First", "...", "Alice")
    id2 = repo.create("Second", "...", "Bob")
    id3 = repo.create("Third", "...", "Charlie")

    repo.publish(id1)
    repo.publish(id3)

    published = repo.find_published()
    assert len(published) == 2
    titles = [a["title"] for a in published]
    assert "First" in titles
    assert "Third" in titles
    assert "Second" not in titles
```

**Limitation**: SQLite doesn't behave exactly like PostgreSQL or MySQL.
If your production database is PostgreSQL, some queries might work in
SQLite but fail in Postgres (or vice versa).

---

## Strategy 2: Transaction Rollback

Start a transaction before each test, roll it back after. The database
is always clean:

```
TRANSACTION ROLLBACK PATTERN

  Before test:
    BEGIN TRANSACTION
    ┌──────────────────────────┐
    │  Test runs here          │
    │  INSERT, UPDATE, DELETE  │
    │  All changes are visible │
    │  WITHIN the transaction  │
    └──────────────────────────┘
    ROLLBACK

  After rollback:
    Database is EXACTLY as it was before the test.
    No cleanup needed. No stale data. Fast.
```

### Python with SQLAlchemy

```python
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

@pytest.fixture
def db_session():
    engine = create_engine("postgresql://test:test@localhost/testdb")
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()

def test_create_user(db_session):
    user = User(name="Alice", email="alice@example.com")
    db_session.add(user)
    db_session.flush()

    found = db_session.query(User).filter_by(email="alice@example.com").first()
    assert found is not None
    assert found.name == "Alice"
```

### Go with Transaction Rollback

```go
func setupTestTx(t *testing.T) *sql.Tx {
    t.Helper()
    db, err := sql.Open("postgres", "postgres://test:test@localhost/testdb?sslmode=disable")
    if err != nil {
        t.Fatalf("failed to connect: %v", err)
    }

    tx, err := db.Begin()
    if err != nil {
        t.Fatalf("failed to begin tx: %v", err)
    }

    t.Cleanup(func() {
        tx.Rollback()
        db.Close()
    })

    return tx
}

func TestCreateAndFindUser(t *testing.T) {
    tx := setupTestTx(t)

    _, err := tx.Exec("INSERT INTO users (name, email) VALUES ($1, $2)", "Alice", "alice@example.com")
    if err != nil {
        t.Fatalf("insert failed: %v", err)
    }

    var name string
    err = tx.QueryRow("SELECT name FROM users WHERE email = $1", "alice@example.com").Scan(&name)
    if err != nil {
        t.Fatalf("query failed: %v", err)
    }

    if name != "Alice" {
        t.Errorf("expected Alice, got %s", name)
    }
}
```

---

## Strategy 3: Testcontainers

For testing against the exact same database you use in production:

```
TESTCONTAINERS WORKFLOW

  ┌─────────────┐
  │ Test starts  │
  └──────┬──────┘
         │
         v
  ┌─────────────────────────────────┐
  │ Start Docker container          │
  │ postgres:16 on random port      │
  │ Wait for "database is ready"    │
  └──────┬──────────────────────────┘
         │
         v
  ┌─────────────────────────────────┐
  │ Run migrations                  │
  │ CREATE TABLE users (...)        │
  │ CREATE TABLE orders (...)       │
  └──────┬──────────────────────────┘
         │
         v
  ┌─────────────────────────────────┐
  │ Run tests                       │
  │ (Each test can use rollback     │
  │  or fresh container)            │
  └──────┬──────────────────────────┘
         │
         v
  ┌─────────────────────────────────┐
  │ Destroy container               │
  │ Clean slate. No artifacts.      │
  └─────────────────────────────────┘
```

```python
import pytest
from testcontainers.postgres import PostgresContainer

@pytest.fixture(scope="session")
def pg_container():
    with PostgresContainer("postgres:16") as pg:
        yield pg

@pytest.fixture
def db_conn(pg_container):
    import psycopg2
    conn = psycopg2.connect(pg_container.get_connection_url())
    conn.autocommit = False

    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS products (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            price NUMERIC(10, 2) NOT NULL,
            stock INTEGER NOT NULL DEFAULT 0
        )
    """)
    conn.commit()

    yield conn

    conn.rollback()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM products")
    conn.commit()
    conn.close()

def test_product_stock_constraint(db_conn):
    cursor = db_conn.cursor()
    cursor.execute(
        "INSERT INTO products (name, price, stock) VALUES (%s, %s, %s)",
        ("Widget", 9.99, 100)
    )
    db_conn.commit()

    cursor.execute("SELECT stock FROM products WHERE name = %s", ("Widget",))
    stock = cursor.fetchone()[0]
    assert stock == 100
```

---

## Testing Migrations

Database migrations are code too and need testing:

```
MIGRATION TESTING STRATEGY

  1. Start with an EMPTY database
  2. Run ALL migrations from scratch
  3. Verify the final schema matches expectations
  4. Insert sample data
  5. Run a DOWN migration
  6. Run the UP migration again
  7. Verify data survives the round-trip

  ┌──────────┐    ┌──────────┐    ┌──────────┐
  │ Empty DB │───→│ V1       │───→│ V2       │───→ ...
  └──────────┘    │ users    │    │ users    │
                  │          │    │ +email   │
                  └──────────┘    └──────────┘
                                       │
                                  Run DOWN ↓ then UP ↑
                                       │
                                  Same schema? ✓
                                  Data intact? ✓
```

```python
def test_migrations_from_scratch(db_conn):
    run_all_migrations(db_conn)

    tables = get_table_names(db_conn)
    assert "users" in tables
    assert "products" in tables
    assert "orders" in tables

    columns = get_column_names(db_conn, "users")
    assert "id" in columns
    assert "email" in columns
    assert "created_at" in columns

def test_migration_rollback(db_conn):
    run_all_migrations(db_conn)

    insert_test_data(db_conn)
    user_count_before = count_rows(db_conn, "users")

    rollback_last_migration(db_conn)
    run_last_migration(db_conn)

    user_count_after = count_rows(db_conn, "users")
    assert user_count_after == user_count_before
```

---

## Fixtures vs Factories for Database Data

```
FIXTURES (SQL seed files)

  Pros:
    - Simple and explicit
    - Easy to review in version control
    - Good for reference/lookup data

  Cons:
    - Rigid — hard to customize per test
    - Can grow stale
    - Hidden dependencies between tests

  Best for: lookup tables, configuration data, shared reference data


FACTORIES (programmatic creation)

  Pros:
    - Customizable per test
    - Only create what the test needs
    - Self-documenting — test shows its own data

  Cons:
    - More code to write
    - Can be slow if creating complex object graphs

  Best for: test-specific data, varying scenarios
```

### Database Factory Example

```python
class DBFactory:
    def __init__(self, conn):
        self.conn = conn
        self._user_count = 0

    def create_user(self, **overrides):
        self._user_count += 1
        defaults = {
            "name": f"User {self._user_count}",
            "email": f"user{self._user_count}@example.com",
            "active": True,
        }
        data = {**defaults, **overrides}

        cursor = self.conn.execute(
            "INSERT INTO users (name, email, active) VALUES (?, ?, ?) RETURNING id",
            (data["name"], data["email"], data["active"])
        )
        self.conn.commit()
        data["id"] = cursor.fetchone()[0]
        return data

    def create_order(self, user_id=None, **overrides):
        if user_id is None:
            user = self.create_user()
            user_id = user["id"]

        defaults = {"user_id": user_id, "total": 0.0, "status": "pending"}
        data = {**defaults, **overrides}

        cursor = self.conn.execute(
            "INSERT INTO orders (user_id, total, status) VALUES (?, ?, ?) RETURNING id",
            (data["user_id"], data["total"], data["status"])
        )
        self.conn.commit()
        data["id"] = cursor.fetchone()[0]
        return data

@pytest.fixture
def factory(db_conn):
    return DBFactory(db_conn)

def test_user_orders(factory):
    user = factory.create_user(name="Alice")
    factory.create_order(user_id=user["id"], total=29.99)
    factory.create_order(user_id=user["id"], total=49.99)

    orders = get_user_orders(user["id"])
    assert len(orders) == 2
    assert sum(o["total"] for o in orders) == 79.98
```

---

## Common Database Testing Patterns

```
PATTERN: UNIQUE TEST DATA

  Problem: Tests create users with same email → unique constraint fails
  Solution: Generate unique data per test

  def make_unique_email():
      return f"test-{uuid4()}@example.com"


PATTERN: DATABASE TRUNCATION

  Problem: Need completely clean database between tests
  Solution: TRUNCATE all tables in reverse dependency order

  def clean_database(conn):
      conn.execute("TRUNCATE orders CASCADE")
      conn.execute("TRUNCATE products CASCADE")
      conn.execute("TRUNCATE users CASCADE")


PATTERN: SNAPSHOT COMPARISON

  Problem: Complex query results hard to assert
  Solution: Compare against known-good snapshot

  def test_monthly_report(factory, snapshot):
      factory.create_order(total=100, created_at="2024-01-15")
      factory.create_order(total=200, created_at="2024-01-20")

      report = generate_monthly_report("2024-01")
      assert report == snapshot
```

---

## Exercises

1. **In-memory database**: Create a simple `NoteRepository` backed by
   SQLite in-memory. Write tests for: create, read, update, delete, and
   list all notes.

2. **Transaction rollback**: Implement the transaction rollback pattern
   for a test fixture. Verify that data created in one test doesn't
   appear in the next.

3. **Factory**: Build a database factory for a blog with `authors`,
   `posts`, and `comments` tables. Write tests that use the factory to
   create various scenarios.

4. **Migration testing**: Write a test that creates a table, adds data,
   adds a new column via a migration, and verifies existing data is
   preserved.

---

[Next: Lesson 16 - Performance and Load Testing](./16-performance-testing.md)
