# Lesson 06: Integration Testing

> **The one thing to remember**: Unit tests check individual parts.
> Integration tests check that parts work *together*. Like testing
> that a plug fits into a socket — the plug works fine alone, the socket
> works fine alone, but you need to test them *together* to know if
> power flows.

---

## The Plumbing Analogy

Imagine you're building a house. You've tested every individual pipe
and every faucet — they all work perfectly in isolation. But when you
connect them together:

```
UNIT TESTS SAID EVERYTHING WAS FINE

  [Pipe A] ✓    [Pipe B] ✓    [Faucet] ✓    [Valve] ✓

INTEGRATION TEST REVEALS THE PROBLEM

  [Pipe A]──╮
             ╰──[Wrong adapter]──[Pipe B]──[Faucet]
                      ↑
                  LEAK! The pieces don't fit together.

  Each piece works alone, but the CONNECTION between them fails.
  This is exactly what integration tests catch.
```

Common integration failures:

```
THINGS THAT ONLY BREAK AT INTEGRATION BOUNDARIES

  - SQL query returns columns in wrong order
  - API sends JSON but your code expects XML
  - Database schema was migrated but code still uses old column names
  - Date format is "MM/DD/YYYY" in one system, "YYYY-MM-DD" in another
  - Character encoding mismatch (UTF-8 vs Latin-1)
  - Timezone assumed to be UTC but server is in EST
```

---

## What Integration Tests Look Like

### Testing a Real Database

```python
import sqlite3
import pytest

class TodoRepository:
    def __init__(self, conn):
        self.conn = conn

    def create_table(self):
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS todos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                completed BOOLEAN DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        self.conn.commit()

    def add(self, title):
        cursor = self.conn.execute(
            "INSERT INTO todos (title) VALUES (?)", (title,)
        )
        self.conn.commit()
        return cursor.lastrowid

    def get_all(self):
        rows = self.conn.execute(
            "SELECT id, title, completed FROM todos ORDER BY created_at"
        ).fetchall()
        return [{"id": r[0], "title": r[1], "completed": bool(r[2])} for r in rows]

    def mark_complete(self, todo_id):
        self.conn.execute(
            "UPDATE todos SET completed = 1 WHERE id = ?", (todo_id,)
        )
        self.conn.commit()

@pytest.fixture
def repo():
    conn = sqlite3.connect(":memory:")
    repository = TodoRepository(conn)
    repository.create_table()
    yield repository
    conn.close()

def test_add_and_retrieve_todo(repo):
    repo.add("Buy groceries")
    repo.add("Walk the dog")

    todos = repo.get_all()

    assert len(todos) == 2
    assert todos[0]["title"] == "Buy groceries"
    assert todos[1]["title"] == "Walk the dog"
    assert todos[0]["completed"] is False

def test_mark_todo_complete(repo):
    todo_id = repo.add("Buy groceries")

    repo.mark_complete(todo_id)

    todos = repo.get_all()
    assert todos[0]["completed"] is True

def test_empty_list(repo):
    todos = repo.get_all()
    assert todos == []
```

Notice: we're testing against a *real* SQLite database, not a mock.
The in-memory database keeps it fast, but the SQL actually executes.
This catches bugs that mocks would miss (wrong SQL syntax, wrong column
names, missing constraints).

### Testing an API Endpoint

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";

let server: ReturnType<typeof app.listen>;
let baseUrl: string;

beforeAll(async () => {
  server = app.listen(0);
  const address = server.address() as { port: number };
  baseUrl = `http://localhost:${address.port}`;
});

afterAll(() => {
  server.close();
});

describe("POST /api/users", () => {
  it("creates a user and returns it", async () => {
    const response = await fetch(`${baseUrl}/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Alice", email: "alice@example.com" }),
    });

    expect(response.status).toBe(201);

    const user = await response.json();
    expect(user.name).toBe("Alice");
    expect(user.email).toBe("alice@example.com");
    expect(user.id).toBeDefined();
  });

  it("rejects invalid email", async () => {
    const response = await fetch(`${baseUrl}/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Bob", email: "not-an-email" }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("email");
  });
});

describe("GET /api/users/:id", () => {
  it("returns 404 for nonexistent user", async () => {
    const response = await fetch(`${baseUrl}/api/users/99999`);
    expect(response.status).toBe(404);
  });
});
```

This test starts a real HTTP server and sends real HTTP requests. It
tests the full stack: routing, validation, serialization, database.

---

## Testcontainers: Real Databases in Tests

For production code using PostgreSQL, MySQL, or Redis, in-memory SQLite
won't catch all bugs. Testcontainers spins up real database instances
in Docker for your tests:

```
TESTCONTAINERS CONCEPT

  Before tests:
    1. Pull a Docker image (postgres:16, redis:7, etc.)
    2. Start a container with a random port
    3. Wait for the database to be ready
    4. Run your migrations

  During tests:
    Your code talks to a REAL PostgreSQL/Redis/etc.
    Same SQL dialect, same constraints, same behavior.

  After tests:
    Container is destroyed. Clean slate every time.

  ┌──────────────────────────────────────────────┐
  │  Test Process                                 │
  │                                               │
  │  test_1() ──→ ┌─────────────────────────┐    │
  │  test_2() ──→ │  Docker: PostgreSQL 16   │    │
  │  test_3() ──→ │  Port: 54321 (random)    │    │
  │               │  Fresh database           │    │
  │               └─────────────────────────┘    │
  │                        ↑                      │
  │               Destroyed after tests           │
  └──────────────────────────────────────────────┘
```

### Python with Testcontainers

```python
import pytest
from testcontainers.postgres import PostgresContainer

@pytest.fixture(scope="module")
def postgres():
    with PostgresContainer("postgres:16") as pg:
        yield pg

@pytest.fixture
def connection(postgres):
    import psycopg2
    conn = psycopg2.connect(postgres.get_connection_url())
    conn.autocommit = True
    yield conn
    conn.close()

def test_insert_and_query(connection):
    cursor = connection.cursor()
    cursor.execute("CREATE TABLE IF NOT EXISTS items (id SERIAL, name TEXT)")
    cursor.execute("INSERT INTO items (name) VALUES (%s) RETURNING id", ("Widget",))
    item_id = cursor.fetchone()[0]

    cursor.execute("SELECT name FROM items WHERE id = %s", (item_id,))
    name = cursor.fetchone()[0]

    assert name == "Widget"
```

### Go with Testcontainers

```go
func TestPostgresIntegration(t *testing.T) {
    ctx := context.Background()

    container, err := postgres.Run(ctx, "postgres:16",
        postgres.WithDatabase("testdb"),
        postgres.WithUsername("test"),
        postgres.WithPassword("test"),
        testcontainers.WithWaitStrategy(
            wait.ForLog("database system is ready").
                WithOccurrence(2).
                WithStartupTimeout(5*time.Second)),
    )
    if err != nil {
        t.Fatalf("failed to start container: %v", err)
    }
    defer container.Terminate(ctx)

    connStr, _ := container.ConnectionString(ctx, "sslmode=disable")
    db, err := sql.Open("postgres", connStr)
    if err != nil {
        t.Fatalf("failed to connect: %v", err)
    }
    defer db.Close()

    _, err = db.Exec("CREATE TABLE users (id SERIAL, name TEXT)")
    if err != nil {
        t.Fatalf("failed to create table: %v", err)
    }

    _, err = db.Exec("INSERT INTO users (name) VALUES ($1)", "Alice")
    if err != nil {
        t.Fatalf("failed to insert: %v", err)
    }

    var name string
    err = db.QueryRow("SELECT name FROM users WHERE name = $1", "Alice").Scan(&name)
    if err != nil {
        t.Fatalf("failed to query: %v", err)
    }

    if name != "Alice" {
        t.Errorf("expected Alice, got %s", name)
    }
}
```

---

## When Unit Tests Aren't Enough

```
BUGS THAT ONLY INTEGRATION TESTS CATCH

  Bug: SQL injection vulnerability
  Unit test: Mock returns data → test passes
  Integration test: Real SQL executes → catches the vulnerability

  Bug: ORM generates wrong SQL for complex joins
  Unit test: Mock returns expected data → test passes
  Integration test: Real query runs → returns wrong data → CAUGHT

  Bug: API serialization drops a field
  Unit test: Tests the data object → all fields present
  Integration test: Sends HTTP request → response is missing field → CAUGHT

  Bug: Database migration didn't add a column
  Unit test: Uses mock → doesn't know about schema
  Integration test: Real INSERT fails → CAUGHT
```

---

## Integration Test Best Practices

```
DO                                  DON'T

Use real databases when possible    Mock everything
Clean up after each test            Leave test data around
Use transactions for rollback       Depend on test execution order
Test at API boundaries              Test internal implementation
Use fixtures for common setup       Duplicate setup in every test
Run in CI with Docker               Only run locally
```

### The Transaction Rollback Pattern

```python
@pytest.fixture
def db_session(connection):
    transaction = connection.begin()
    yield connection
    transaction.rollback()

def test_create_user(db_session):
    db_session.execute("INSERT INTO users (name) VALUES ('Alice')")
    result = db_session.execute("SELECT name FROM users").fetchone()
    assert result[0] == "Alice"
```

Every test starts a transaction and rolls it back at the end. The
database is always clean for the next test, and tests run fast because
nothing is actually committed to disk.

---

## Organizing Integration Tests

```
PROJECT STRUCTURE

  tests/
  ├── unit/                   Fast, no external dependencies
  │   ├── test_calculator.py
  │   └── test_validator.py
  ├── integration/            Needs database, API, etc.
  │   ├── test_user_repo.py
  │   ├── test_api_users.py
  │   └── conftest.py         Shared fixtures (db connection, etc.)
  └── e2e/                    Full system tests
      └── test_checkout.py

  Run separately:
    pytest tests/unit           ← Fast: run always
    pytest tests/integration    ← Slower: run before merge
    pytest tests/e2e            ← Slowest: run in CI
```

---

## Exercises

1. **Write integration tests**: Create a simple key-value store using
   SQLite. Write integration tests that verify: insert, lookup, update,
   delete, and handling of missing keys.

2. **API testing**: If you have a web API (or build a simple one), write
   integration tests that send real HTTP requests and check responses.
   Test both success and error cases.

3. **Spot the gap**: Look at a project with only unit tests. List three
   bugs that could slip through because there are no integration tests.

4. **Transaction rollback**: Implement the transaction rollback pattern
   for your test database. Verify that tests don't leave data behind by
   checking the row count before and after.

---

[Next: Lesson 07 - End-to-End Testing](./07-e2e-testing.md)
