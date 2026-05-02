# Lesson 15: Database Access

## database/sql: The Standard Interface

Go's `database/sql` package provides a generic interface around
SQL databases. Think of it as a universal remote control — one
interface, many TV brands (PostgreSQL, MySQL, SQLite).

```
Your Code
   |
   v
database/sql  (standard interface)
   |
   +---> lib/pq         (PostgreSQL driver)
   +---> go-sqlite3     (SQLite driver)
   +---> go-sql-driver  (MySQL driver)
```

In Rust, you'd use `sqlx` or `diesel`. Go's `database/sql` is
the stdlib equivalent, and `sqlx` (Go version) extends it.

---

## Connecting to a Database

```go
package main

import (
    "database/sql"
    "fmt"
    "log"

    _ "github.com/lib/pq"
)

func main() {
    db, err := sql.Open("postgres", "postgres://user:pass@localhost:5432/mydb?sslmode=disable")
    if err != nil {
        log.Fatal(err)
    }
    defer db.Close()

    if err := db.Ping(); err != nil {
        log.Fatal("cannot reach database:", err)
    }

    fmt.Println("Connected!")
}
```

`sql.Open` doesn't actually connect — it just validates the DSN.
`db.Ping()` verifies the connection. Always ping after opening.

The blank import `_ "github.com/lib/pq"` registers the driver
via its `init()` function.

---

## Connection Pool Configuration

`sql.DB` is a connection pool, not a single connection.

```
+-------------------------------------------+
|               sql.DB Pool                  |
|                                            |
|  +------+  +------+  +------+  +------+   |
|  | Conn |  | Conn |  | Conn |  | Conn |   |
|  +------+  +------+  +------+  +------+   |
|                                            |
|  MaxOpenConns: 25                          |
|  MaxIdleConns: 5                           |
|  ConnMaxLifetime: 5m                       |
|  ConnMaxIdleTime: 1m                       |
+-------------------------------------------+
```

```go
func setupDB(dsn string) (*sql.DB, error) {
    db, err := sql.Open("postgres", dsn)
    if err != nil {
        return nil, err
    }

    db.SetMaxOpenConns(25)
    db.SetMaxIdleConns(5)
    db.SetConnMaxLifetime(5 * time.Minute)
    db.SetConnMaxIdleTime(1 * time.Minute)

    if err := db.Ping(); err != nil {
        return nil, fmt.Errorf("ping database: %w", err)
    }

    return db, nil
}
```

Always configure pool settings. The defaults (unlimited connections,
no lifetime) are dangerous in production.

---

## CRUD Operations

### Create

```go
func createUser(db *sql.DB, name, email string) (int64, error) {
    result, err := db.Exec(
        "INSERT INTO users (name, email) VALUES ($1, $2)",
        name, email,
    )
    if err != nil {
        return 0, fmt.Errorf("insert user: %w", err)
    }
    return result.LastInsertId()
}
```

### Read (Single Row)

```go
type User struct {
    ID    int64
    Name  string
    Email string
}

func getUser(db *sql.DB, id int64) (*User, error) {
    var user User
    err := db.QueryRow(
        "SELECT id, name, email FROM users WHERE id = $1", id,
    ).Scan(&user.ID, &user.Name, &user.Email)

    if err == sql.ErrNoRows {
        return nil, fmt.Errorf("user %d not found", id)
    }
    if err != nil {
        return nil, fmt.Errorf("query user: %w", err)
    }
    return &user, nil
}
```

### Read (Multiple Rows)

```go
func listUsers(db *sql.DB) ([]User, error) {
    rows, err := db.Query("SELECT id, name, email FROM users ORDER BY name")
    if err != nil {
        return nil, fmt.Errorf("query users: %w", err)
    }
    defer rows.Close()

    var users []User
    for rows.Next() {
        var u User
        if err := rows.Scan(&u.ID, &u.Name, &u.Email); err != nil {
            return nil, fmt.Errorf("scan user: %w", err)
        }
        users = append(users, u)
    }

    if err := rows.Err(); err != nil {
        return nil, fmt.Errorf("rows iteration: %w", err)
    }

    return users, nil
}
```

Always:
- `defer rows.Close()` after `Query`
- Check `rows.Err()` after the loop
- Use `$1, $2` placeholders, NEVER string formatting (SQL injection!)

```
NEVER DO THIS:
  db.Query("SELECT * FROM users WHERE name = '" + name + "'")

ALWAYS DO THIS:
  db.Query("SELECT * FROM users WHERE name = $1", name)
```

### Update and Delete

```go
func updateUserEmail(db *sql.DB, id int64, email string) error {
    result, err := db.Exec(
        "UPDATE users SET email = $1 WHERE id = $2",
        email, id,
    )
    if err != nil {
        return fmt.Errorf("update user: %w", err)
    }

    rows, _ := result.RowsAffected()
    if rows == 0 {
        return fmt.Errorf("user %d not found", id)
    }
    return nil
}

func deleteUser(db *sql.DB, id int64) error {
    _, err := db.Exec("DELETE FROM users WHERE id = $1", id)
    return err
}
```

---

## Using Context

Always pass context to database operations in production:

```go
func getUserCtx(ctx context.Context, db *sql.DB, id int64) (*User, error) {
    var user User
    err := db.QueryRowContext(ctx,
        "SELECT id, name, email FROM users WHERE id = $1", id,
    ).Scan(&user.ID, &user.Name, &user.Email)

    if err == sql.ErrNoRows {
        return nil, fmt.Errorf("user %d not found", id)
    }
    if err != nil {
        return nil, fmt.Errorf("query user: %w", err)
    }
    return &user, nil
}
```

Context enables request cancellation — if a user disconnects,
the database query cancels too.

---

## Transactions

```go
func transferFunds(db *sql.DB, fromID, toID int64, amount float64) error {
    tx, err := db.Begin()
    if err != nil {
        return fmt.Errorf("begin tx: %w", err)
    }
    defer tx.Rollback()

    var balance float64
    err = tx.QueryRow("SELECT balance FROM accounts WHERE id = $1 FOR UPDATE", fromID).Scan(&balance)
    if err != nil {
        return fmt.Errorf("get balance: %w", err)
    }

    if balance < amount {
        return fmt.Errorf("insufficient funds: have %.2f, need %.2f", balance, amount)
    }

    _, err = tx.Exec("UPDATE accounts SET balance = balance - $1 WHERE id = $2", amount, fromID)
    if err != nil {
        return fmt.Errorf("debit: %w", err)
    }

    _, err = tx.Exec("UPDATE accounts SET balance = balance + $1 WHERE id = $2", amount, toID)
    if err != nil {
        return fmt.Errorf("credit: %w", err)
    }

    return tx.Commit()
}
```

The `defer tx.Rollback()` is safe — rollback on a committed
transaction is a no-op.

---

## sqlx: database/sql Extended

`sqlx` adds struct scanning and named queries:

```go
package main

import (
    "fmt"
    "log"

    "github.com/jmoiron/sqlx"
    _ "github.com/lib/pq"
)

type User struct {
    ID    int64  `db:"id"`
    Name  string `db:"name"`
    Email string `db:"email"`
}

func main() {
    db, err := sqlx.Connect("postgres", "postgres://user:pass@localhost:5432/mydb?sslmode=disable")
    if err != nil {
        log.Fatal(err)
    }

    var users []User
    err = db.Select(&users, "SELECT id, name, email FROM users ORDER BY name")
    if err != nil {
        log.Fatal(err)
    }

    for _, u := range users {
        fmt.Printf("%d: %s (%s)\n", u.ID, u.Name, u.Email)
    }

    var user User
    err = db.Get(&user, "SELECT id, name, email FROM users WHERE id = $1", 1)
    if err != nil {
        log.Fatal(err)
    }
    fmt.Printf("Found: %+v\n", user)
}
```

`db.Select` scans into a slice. `db.Get` scans a single row.
Much less boilerplate than raw `database/sql`.

---

## Migrations

Use a migration tool to manage schema changes:

```
migrations/
  001_create_users.up.sql
  001_create_users.down.sql
  002_add_email_index.up.sql
  002_add_email_index.down.sql
```

Popular tools:
- `golang-migrate/migrate`
- `pressly/goose`

```sql
-- 001_create_users.up.sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 001_create_users.down.sql
DROP TABLE users;
```

---

## Repository Pattern

```
+-------------------+
|    Handler        |
| (HTTP layer)      |
+--------+----------+
         |
+--------+----------+
|    Service        |
| (business logic)  |
+--------+----------+
         |
+--------+----------+
|    Repository     |
| (database access) |
+-------------------+
```

```go
type UserRepository interface {
    GetByID(ctx context.Context, id int64) (*User, error)
    List(ctx context.Context) ([]User, error)
    Create(ctx context.Context, user *User) error
    Update(ctx context.Context, user *User) error
    Delete(ctx context.Context, id int64) error
}

type postgresUserRepo struct {
    db *sqlx.DB
}

func NewUserRepository(db *sqlx.DB) UserRepository {
    return &postgresUserRepo{db: db}
}

func (r *postgresUserRepo) GetByID(ctx context.Context, id int64) (*User, error) {
    var user User
    err := r.db.GetContext(ctx, &user, "SELECT * FROM users WHERE id = $1", id)
    if err != nil {
        return nil, fmt.Errorf("get user %d: %w", id, err)
    }
    return &user, nil
}
```

The interface makes testing easy — swap in a mock repository
for unit tests.

---

## Exercises

1. Set up an SQLite database (using `modernc.org/sqlite`) and
   create a users table with CRUD operations

2. Implement a repository interface for a "tasks" table with
   `List`, `Create`, `Complete`, and `Delete` methods

3. Write a function that transfers between accounts using
   transactions, handling insufficient funds

4. Add context with timeout to all database queries

5. Write table-driven tests for your repository using an in-memory
   SQLite database

---

[Next: Lesson 16 - Context & Cancellation ->](16-context-and-cancellation.md)
