# Lesson 20: sqlx — Async Postgres from Rust

You know SQL. You know Rust. Now it's time to connect them.

sqlx is an async, pure-Rust SQL crate with a killer feature: **compile-time
checked queries**. Your SQL is verified against your actual database schema
at build time. If you rename a column and forget to update a query, it
won't compile.

---

## What sqlx Is (and Isn't)

sqlx is **not** an ORM. You write real SQL. sqlx just makes sure it's correct
and handles the plumbing: connection pooling, row mapping, prepared statements,
migrations.

| Feature | sqlx (Rust) | database/sql + sqlx (Go) | node-postgres (TS) |
|---------|------------|--------------------------|---------------------|
| Write raw SQL | Yes | Yes | Yes |
| Compile-time SQL checks | Yes | No | No |
| Async | Yes (native) | No (goroutines) | Yes (promises) |
| Connection pooling | Built-in | Built-in | Via `pg.Pool` |
| Migrations | Built-in CLI | goose/migrate (separate) | knex/db-migrate |
| ORM | No | No | No (but see TypeORM) |

**If you're coming from Go:** sqlx in Rust is similar in philosophy to
jmoiron/sqlx for Go (raw SQL, struct mapping) but adds compile-time checks
and is natively async.

---

## Setup

### 1. Create a new project

```bash
cargo new task_db && cd task_db
```

### 2. Add dependencies

```bash
cargo add sqlx --features runtime-tokio,tls-rustls,postgres,macros,migrate
cargo add tokio --features full
cargo add dotenvy
```

This gives you:
- `runtime-tokio` — use Tokio as the async runtime
- `tls-rustls` — TLS via rustls (no OpenSSL dependency)
- `postgres` — PostgreSQL driver
- `macros` — the `query!` macro for compile-time checks
- `migrate` — built-in migration support

### 3. Set DATABASE_URL

Create a `.env` file in the project root:

```bash
DATABASE_URL=postgres://your_user:your_password@localhost:5432/learn_db
```

sqlx reads this at compile time (for the `query!` macro) and at runtime
(for connecting). The `dotenvy` crate loads it from `.env` into the
environment.

### 4. Make sure your database exists

```bash
createdb learn_db
```

---

## Connecting to Postgres

The core type is `PgPool` — a pool of reusable connections:

```rust
use sqlx::postgres::PgPool;

#[tokio::main]
async fn main() -> Result<(), sqlx::Error> {
    dotenvy::dotenv().ok();

    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set");

    let pool = PgPool::connect(&database_url).await?;

    println!("Connected to Postgres");

    let row: (i64,) = sqlx::query_as("SELECT $1::BIGINT")
        .bind(150_i64)
        .fetch_one(&pool)
        .await?;

    assert_eq!(row.0, 150);
    println!("Query returned: {}", row.0);

    Ok(())
}
```

**Key points:**
- `PgPool::connect` creates a connection pool (default: 10 connections).
- The pool is `Clone` and `Send + Sync` — share it freely across tasks.
- Every query borrows from the pool; connections are returned automatically.

**Go comparison:** In Go, `sql.Open` creates a pool too, but you get `*sql.DB`
which is roughly equivalent to `PgPool`. Same concept, different type names.

---

## Basic Queries

sqlx gives you three query functions, each returning data differently.

### sqlx::query() — returns raw rows

```rust
use sqlx::Row;

let rows = sqlx::query("SELECT id, name, email FROM users WHERE id < $1")
    .bind(10_i32)
    .fetch_all(&pool)
    .await?;

for row in &rows {
    let id: i32 = row.get("id");
    let name: String = row.get("name");
    let email: String = row.get("email");
    println!("{}: {} <{}>", id, name, email);
}
```

`row.get("column_name")` extracts a value by column name. You can also use
positional indexing: `row.get::<String, _>(1)`.

### sqlx::query_as() — maps rows to a struct

```rust
use sqlx::FromRow;

#[derive(Debug, FromRow)]
struct User {
    id: i32,
    name: String,
    email: String,
}

let users: Vec<User> = sqlx::query_as::<_, User>(
    "SELECT id, name, email FROM users WHERE id < $1"
)
    .bind(10_i32)
    .fetch_all(&pool)
    .await?;

for user in &users {
    println!("{}: {} <{}>", user.id, user.name, user.email);
}
```

`FromRow` derives automatic mapping from SQL column names to struct fields.
The column names in your SELECT must match the struct field names.

### sqlx::query_scalar() — returns a single value

```rust
let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
    .fetch_one(&pool)
    .await?;

println!("Total users: {}", count);
```

Perfect for `COUNT(*)`, `MAX()`, `EXISTS()`, or any query returning one column.

---

## Fetch Methods

Every query builder supports multiple fetch strategies:

| Method | Returns | Use when |
|--------|---------|----------|
| `.fetch_one(&pool)` | Single row | You expect exactly one result |
| `.fetch_optional(&pool)` | `Option<row>` | Might be 0 or 1 result |
| `.fetch_all(&pool)` | `Vec<row>` | You want all results in memory |
| `.fetch(&pool)` | `Stream<row>` | Large result sets (streaming) |

```rust
let maybe_user: Option<User> = sqlx::query_as::<_, User>(
    "SELECT id, name, email FROM users WHERE email = $1"
)
    .bind("alice@example.com")
    .fetch_optional(&pool)
    .await?;

match maybe_user {
    Some(user) => println!("Found: {}", user.name),
    None => println!("No user with that email"),
}
```

**Go comparison:** `fetch_one` is like `QueryRow`, `fetch_all` is like `Query`
then iterating. `fetch_optional` has no direct Go equivalent — in Go you check
`sql.ErrNoRows` manually.

---

## The query! Macro — Compile-Time SQL Verification

This is sqlx's superpower. The `query!` macro connects to your database
at compile time and verifies:

1. Your SQL syntax is valid
2. The tables and columns exist
3. The parameter types match
4. The return types are correct

```rust
let user = sqlx::query!(
    "SELECT id, name, email FROM users WHERE id = $1",
    user_id
)
    .fetch_one(&pool)
    .await?;

println!("{}: {}", user.id, user.name);
```

Notice: no `.bind()` call. Parameters are passed directly to the macro.
The return type is an anonymous struct with typed fields — `user.id` is
already `i32`, `user.name` is already `String`.

### query_as! — compile-time checks + struct mapping

```rust
#[derive(Debug)]
struct User {
    id: i32,
    name: String,
    email: String,
}

let user = sqlx::query_as!(
    User,
    "SELECT id, name, email FROM users WHERE id = $1",
    user_id
)
    .fetch_one(&pool)
    .await?;
```

### How compile-time checking works

When you run `cargo build`, sqlx:
1. Reads `DATABASE_URL` from `.env`
2. Connects to the database
3. Sends each `query!` SQL to Postgres for analysis (using PREPARE)
4. Checks parameter and return types
5. If anything is wrong, you get a **compile error**, not a runtime error

If you rename the `email` column to `email_address` and forget to update
your Rust code:

```
error: column "email" does not exist
  --> src/main.rs:12:5
   |
12 |     sqlx::query!("SELECT id, name, email FROM users WHERE id = $1", user_id)
   |     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
```

### Offline mode (for CI without a database)

You can save query metadata for building without a live database:

```bash
cargo sqlx prepare
```

This creates a `.sqlx/` directory with JSON files describing each query.
Check it into version control. Now `cargo build` works without `DATABASE_URL`
by reading the cached metadata.

---

## Mapping Rows to Structs with FromRow

`FromRow` maps SQL columns to struct fields by name:

```rust
use sqlx::FromRow;

#[derive(Debug, FromRow)]
struct User {
    id: i32,
    name: String,
    email: String,
    created_at: chrono::NaiveDateTime,
}
```

### Renaming columns

When your SQL column name differs from the Rust field name:

```rust
#[derive(Debug, FromRow)]
struct UserSummary {
    id: i32,
    name: String,
    #[sqlx(rename = "email_address")]
    email: String,
}
```

### Flattening nested structs

```rust
#[derive(Debug, FromRow)]
struct Address {
    city: String,
    country: String,
}

#[derive(Debug, FromRow)]
struct UserWithAddress {
    id: i32,
    name: String,
    #[sqlx(flatten)]
    address: Address,
}
```

### Type mapping: Postgres to Rust

| PostgreSQL | Rust | Notes |
|-----------|------|-------|
| `INTEGER` / `INT4` | `i32` | |
| `BIGINT` / `INT8` | `i64` | |
| `SMALLINT` / `INT2` | `i16` | |
| `BOOLEAN` | `bool` | |
| `TEXT` / `VARCHAR` | `String` | |
| `REAL` / `FLOAT4` | `f32` | |
| `DOUBLE PRECISION` | `f64` | |
| `TIMESTAMP` | `chrono::NaiveDateTime` | Requires `chrono` feature |
| `TIMESTAMPTZ` | `chrono::DateTime<Utc>` | Requires `chrono` feature |
| `UUID` | `uuid::Uuid` | Requires `uuid` feature |
| `JSONB` | `serde_json::Value` | Requires `json` feature |
| `BYTEA` | `Vec<u8>` | |
| `NUMERIC` / `DECIMAL` | `rust_decimal::Decimal` | Requires `rust_decimal` feature |

To use `chrono` or `uuid` types, add the corresponding sqlx feature:

```bash
cargo add sqlx --features chrono,uuid
cargo add chrono
cargo add uuid --features v4
```

---

## INSERT, UPDATE, DELETE

### INSERT

```rust
let result = sqlx::query(
    "INSERT INTO users (name, email) VALUES ($1, $2)"
)
    .bind("Alice")
    .bind("alice@example.com")
    .execute(&pool)
    .await?;

println!("Rows affected: {}", result.rows_affected());
```

### INSERT with RETURNING

Postgres lets you return the inserted row:

```rust
#[derive(Debug, FromRow)]
struct User {
    id: i32,
    name: String,
    email: String,
}

let user: User = sqlx::query_as(
    "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id, name, email"
)
    .bind("Bob")
    .bind("bob@example.com")
    .fetch_one(&pool)
    .await?;

println!("Created user with id: {}", user.id);
```

**Go comparison:** In Go you'd use `QueryRow` with `RETURNING` and `Scan`
into variables. Same SQL, more verbose mapping.

### UPDATE

```rust
let result = sqlx::query(
    "UPDATE users SET email = $1 WHERE id = $2"
)
    .bind("newemail@example.com")
    .bind(42_i32)
    .execute(&pool)
    .await?;

if result.rows_affected() == 0 {
    println!("No user found with that id");
}
```

### DELETE

```rust
let result = sqlx::query("DELETE FROM users WHERE id = $1")
    .bind(42_i32)
    .execute(&pool)
    .await?;

println!("Deleted {} rows", result.rows_affected());
```

---

## Parameterized Queries (Preventing SQL Injection)

**Never** build SQL strings by concatenating user input:

```rust
// WRONG — SQL injection vulnerability
let query = format!("SELECT * FROM users WHERE name = '{}'", user_input);
```

If `user_input` is `'; DROP TABLE users; --`, your table is gone.

**Always** use bind parameters:

```rust
// CORRECT — parameterized query
let users = sqlx::query_as::<_, User>(
    "SELECT * FROM users WHERE name = $1"
)
    .bind(&user_input)
    .fetch_all(&pool)
    .await?;
```

Postgres numbered parameters (`$1`, `$2`, `$3`) correspond to `.bind()` calls
in order. The database treats bound values as data, never as SQL code.

**Go comparison:** Same concept. In Go you write `db.Query("SELECT * FROM users WHERE name = $1", userInput)`. The principle is identical.

---

## Handling NULL with Option\<T\>

SQL columns that can be NULL map to `Option<T>` in Rust:

```rust
#[derive(Debug, FromRow)]
struct User {
    id: i32,
    name: String,
    email: String,
    bio: Option<String>,
    avatar_url: Option<String>,
    deleted_at: Option<chrono::NaiveDateTime>,
}

let user: User = sqlx::query_as(
    "SELECT id, name, email, bio, avatar_url, deleted_at FROM users WHERE id = $1"
)
    .bind(1_i32)
    .fetch_one(&pool)
    .await?;

match &user.bio {
    Some(bio) => println!("Bio: {}", bio),
    None => println!("No bio set"),
}
```

Binding NULL values:

```rust
let bio: Option<&str> = None;

sqlx::query("UPDATE users SET bio = $1 WHERE id = $2")
    .bind(bio)
    .bind(1_i32)
    .execute(&pool)
    .await?;
```

This sets `bio` to NULL. Rust's type system makes NULL handling explicit —
you can't accidentally forget to check for NULL the way you can in Go
(where you'd use `sql.NullString` or `*string`).

---

## Transactions

A transaction groups multiple operations into an atomic unit: either all
succeed or all roll back.

```rust
let mut tx = pool.begin().await?;

let user: User = sqlx::query_as(
    "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id, name, email"
)
    .bind("Charlie")
    .bind("charlie@example.com")
    .fetch_one(&mut *tx)
    .await?;

sqlx::query(
    "INSERT INTO user_profiles (user_id, display_name) VALUES ($1, $2)"
)
    .bind(user.id)
    .bind("Charlie D.")
    .execute(&mut *tx)
    .await?;

tx.commit().await?;

println!("User and profile created atomically");
```

**Key points:**
- `pool.begin()` starts a transaction and returns a `Transaction`.
- Pass `&mut *tx` instead of `&pool` to run queries in the transaction.
- Call `tx.commit()` to persist. If the transaction is dropped without
  committing, it automatically rolls back.
- This drop-based rollback is Rust's ownership system at work — RAII for
  database transactions.

### Explicit rollback

```rust
let mut tx = pool.begin().await?;

let result = do_something(&mut tx).await;

match result {
    Ok(_) => tx.commit().await?,
    Err(e) => {
        tx.rollback().await?;
        return Err(e);
    }
}
```

But since dropping the transaction also rolls back, you can simplify by
using `?` propagation — if an error occurs, the function returns early,
`tx` is dropped, and the transaction rolls back automatically.

**Go comparison:** In Go, you call `tx.Rollback()` in a deferred function
and `tx.Commit()` at the end. Rust's drop semantics serve the same purpose
without needing `defer`.

---

## Error Handling

`sqlx::Error` covers all database errors:

```rust
use sqlx::Error as SqlxError;

async fn get_user(pool: &PgPool, id: i32) -> Result<User, SqlxError> {
    sqlx::query_as::<_, User>(
        "SELECT id, name, email FROM users WHERE id = $1"
    )
        .bind(id)
        .fetch_one(pool)
        .await
}

async fn handle_user(pool: &PgPool, id: i32) {
    match get_user(pool, id).await {
        Ok(user) => println!("Found: {}", user.name),
        Err(SqlxError::RowNotFound) => println!("User {} not found", id),
        Err(SqlxError::Database(db_err)) => {
            if db_err.is_unique_violation() {
                println!("Duplicate entry");
            } else if db_err.is_foreign_key_violation() {
                println!("Referenced record doesn't exist");
            } else {
                println!("Database error: {}", db_err);
            }
        }
        Err(e) => println!("Other error: {}", e),
    }
}
```

### Common error variants

| Variant | When it happens |
|---------|-----------------|
| `RowNotFound` | `fetch_one` returns no rows |
| `Database(e)` | Constraint violations, syntax errors, permission denied |
| `PoolTimedOut` | All connections busy, acquire timed out |
| `PoolClosed` | Pool was shut down |
| `Configuration` | Bad connection string |
| `Io` | Network failure |

### Mapping to application errors

In real applications, you convert `sqlx::Error` to your own error type:

```rust
use thiserror::Error;

#[derive(Debug, Error)]
enum AppError {
    #[error("user not found")]
    NotFound,
    #[error("email already exists")]
    DuplicateEmail,
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
}

async fn create_user(pool: &PgPool, name: &str, email: &str) -> Result<User, AppError> {
    sqlx::query_as::<_, User>(
        "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id, name, email"
    )
        .bind(name)
        .bind(email)
        .fetch_one(pool)
        .await
        .map_err(|e| match e {
            sqlx::Error::Database(ref db_err) if db_err.is_unique_violation() => {
                AppError::DuplicateEmail
            }
            other => AppError::Database(other),
        })
}
```

---

## Migrations

sqlx has a built-in migration system.

### Install the CLI

```bash
cargo install sqlx-cli --features postgres
```

### Create and run migrations

```bash
sqlx migrate add create_users_table
```

This creates a file like `migrations/20240115120000_create_users_table.sql`.
Edit it:

```sql
-- migrations/20240115120000_create_users_table.sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    bio TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

Run all pending migrations:

```bash
sqlx migrate run
```

### Reversible migrations

```bash
sqlx migrate add -r create_users_table
```

This creates two files:
- `migrations/20240115120000_create_users_table.up.sql`
- `migrations/20240115120000_create_users_table.down.sql`

The `.down.sql` file undoes the migration:

```sql
-- migrations/20240115120000_create_users_table.down.sql
DROP TABLE users;
```

Revert the last migration:

```bash
sqlx migrate revert
```

### Running migrations from Rust code

Useful for ensuring migrations are applied on application startup:

```rust
use sqlx::migrate::Migrator;
use std::path::Path;

#[tokio::main]
async fn main() -> Result<(), sqlx::Error> {
    dotenvy::dotenv().ok();
    let pool = PgPool::connect(&std::env::var("DATABASE_URL").unwrap()).await?;

    sqlx::migrate!("./migrations")
        .run(&pool)
        .await?;

    println!("Migrations applied");

    Ok(())
}
```

The `sqlx::migrate!` macro embeds migration files into your binary at
compile time, so you don't need to ship the migration files separately.

---

## .env and DATABASE_URL

The standard setup:

```bash
# .env (project root, add to .gitignore)
DATABASE_URL=postgres://user:password@localhost:5432/learn_db
```

Load it in your code:

```rust
dotenvy::dotenv().ok();
let url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
```

**For different environments**, use environment variables directly:

```bash
# Development (from .env)
DATABASE_URL=postgres://dev:dev@localhost:5432/learn_db

# Production (set in environment, not in .env)
DATABASE_URL=postgres://app:secret@prod-host:5432/app_db?sslmode=require
```

Always add `.env` to `.gitignore`. Never commit database credentials.

---

## Full Working Example

Let's tie everything together. This program creates a table, inserts users,
queries them, and demonstrates transactions:

```rust
use sqlx::postgres::PgPool;
use sqlx::FromRow;

#[derive(Debug, FromRow)]
struct User {
    id: i32,
    name: String,
    email: String,
    bio: Option<String>,
}

async fn setup_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            bio TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )"
    )
        .execute(pool)
        .await?;

    Ok(())
}

async fn create_user(
    pool: &PgPool,
    name: &str,
    email: &str,
    bio: Option<&str>,
) -> Result<User, sqlx::Error> {
    sqlx::query_as::<_, User>(
        "INSERT INTO users (name, email, bio)
         VALUES ($1, $2, $3)
         RETURNING id, name, email, bio"
    )
        .bind(name)
        .bind(email)
        .bind(bio)
        .fetch_one(pool)
        .await
}

async fn get_user_by_email(pool: &PgPool, email: &str) -> Result<Option<User>, sqlx::Error> {
    sqlx::query_as::<_, User>(
        "SELECT id, name, email, bio FROM users WHERE email = $1"
    )
        .bind(email)
        .fetch_optional(pool)
        .await
}

async fn list_users(pool: &PgPool) -> Result<Vec<User>, sqlx::Error> {
    sqlx::query_as::<_, User>(
        "SELECT id, name, email, bio FROM users ORDER BY id"
    )
        .fetch_all(pool)
        .await
}

async fn update_bio(pool: &PgPool, user_id: i32, bio: &str) -> Result<bool, sqlx::Error> {
    let result = sqlx::query(
        "UPDATE users SET bio = $1 WHERE id = $2"
    )
        .bind(bio)
        .bind(user_id)
        .execute(pool)
        .await?;

    Ok(result.rows_affected() > 0)
}

async fn delete_user(pool: &PgPool, user_id: i32) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(user_id)
        .execute(pool)
        .await?;

    Ok(result.rows_affected() > 0)
}

async fn transfer_tasks_transaction(
    pool: &PgPool,
    from_id: i32,
    to_id: i32,
) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;

    sqlx::query("UPDATE tasks SET assignee_id = $1 WHERE assignee_id = $2")
        .bind(to_id)
        .bind(from_id)
        .execute(&mut *tx)
        .await?;

    sqlx::query(
        "INSERT INTO audit_log (action, details) VALUES ($1, $2)"
    )
        .bind("transfer_tasks")
        .bind(format!("from user {} to user {}", from_id, to_id))
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(())
}

#[tokio::main]
async fn main() -> Result<(), sqlx::Error> {
    dotenvy::dotenv().ok();

    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set in .env");

    let pool = PgPool::connect(&database_url).await?;

    setup_table(&pool).await?;

    let alice = create_user(&pool, "Alice", "alice@example.com", Some("Rust developer")).await?;
    println!("Created: {:?}", alice);

    let bob = create_user(&pool, "Bob", "bob@example.com", None).await?;
    println!("Created: {:?}", bob);

    let found = get_user_by_email(&pool, "alice@example.com").await?;
    println!("Found by email: {:?}", found);

    let not_found = get_user_by_email(&pool, "nobody@example.com").await?;
    println!("Not found: {:?}", not_found);

    update_bio(&pool, bob.id, "Go developer turned Rustacean").await?;

    let all_users = list_users(&pool).await?;
    println!("All users:");
    for user in &all_users {
        println!("  {:?}", user);
    }

    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
        .fetch_one(&pool)
        .await?;
    println!("Total users: {}", count);

    Ok(())
}
```

---

## Exercises

### Exercise 1: Basic CRUD

Set up a `products` table and write Rust functions for full CRUD:

```sql
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    description TEXT,
    in_stock BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

Write these functions:
- `create_product(pool, name, price, description) -> Result<Product>`
- `get_product(pool, id) -> Result<Option<Product>>`
- `list_products_in_stock(pool) -> Result<Vec<Product>>`
- `update_price(pool, id, new_price) -> Result<bool>`
- `discontinue_product(pool, id) -> Result<bool>` (sets `in_stock = false`)

Use `rust_decimal::Decimal` for the price field (add `cargo add rust_decimal`
and enable the sqlx `rust_decimal` feature).

### Exercise 2: Compile-Time Checked Queries

Rewrite the product functions from Exercise 1 using the `query!` and
`query_as!` macros. Then:
1. Rename the `price` column to `unit_price` in the database
2. Run `cargo build` — observe the compile errors
3. Fix all the queries to match

### Exercise 3: Transactions

Write a function `purchase_product` that:
1. Starts a transaction
2. Checks that the product is in stock
3. Creates an `orders` table entry
4. Decrements a `quantity` column on the product
5. If quantity would go below 0, rolls back
6. Commits if everything succeeds

```rust
async fn purchase_product(
    pool: &PgPool,
    product_id: i32,
    buyer_email: &str,
    quantity: i32,
) -> Result<Order, AppError> {
    // your implementation
}
```

### Exercise 4: Error Handling

Create an `AppError` enum using `thiserror` that wraps sqlx errors into
meaningful application errors. Handle at least:
- Product not found
- Duplicate product name (unique constraint)
- Out of stock
- Database connection failure

Write a function that returns `AppError` and demonstrate matching on each
variant.

### Exercise 5: Migrations

Using `sqlx-cli`:
1. Create a migration for the `products` table
2. Create a migration adding a `category` column
3. Create a migration for an `orders` table with a foreign key to `products`
4. Run all migrations
5. Revert the last migration
6. Run `cargo sqlx prepare` and check the `.sqlx/` directory

---

## Key Takeaways

1. **sqlx is not an ORM.** You write real SQL; sqlx makes it type-safe.
2. **`PgPool` is your connection pool.** Create one, share it everywhere.
3. **`query!` checks SQL at compile time.** Rename a column? Your code won't compile until you fix it.
4. **`FromRow` maps columns to structs.** Names must match.
5. **NULL maps to `Option<T>`.** Rust's type system makes NULL handling explicit.
6. **Transactions auto-rollback on drop.** Rust ownership = RAII for transactions.
7. **Always use bind parameters.** Never concatenate user input into SQL.
8. **Migrations are built in.** `sqlx migrate` handles schema evolution.
9. **Offline mode** lets CI build without a database: `cargo sqlx prepare`.

Next: [Lesson 21 — Connection Pooling, Prepared Statements, and Production Patterns](./21-production-patterns.md)
