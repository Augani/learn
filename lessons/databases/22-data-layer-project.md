# Lesson 22: Building a Complete Data Layer

Time to build something real. In this lesson you'll create a complete data
layer for a task management API — the kind of code that sits between your
web framework (axum) and your database (Postgres).

This is where everything in this course comes together: SQL schema design,
migrations, indexes, Rust ownership, async/await, sqlx, error handling,
and connection pooling.

---

## Project Overview

You're building the data layer for a task management system with:
- **Users** who have accounts
- **Tasks** assigned to users, with status tracking
- **Comments** on tasks

The project structure:

```
task-api/
├── Cargo.toml
├── .env
├── migrations/
│   ├── 20240101000001_create_users.sql
│   ├── 20240101000002_create_tasks.sql
│   └── 20240101000003_create_task_comments.sql
└── src/
    ├── main.rs
    ├── db/
    │   ├── mod.rs          ← Pool setup, migrations
    │   ├── error.rs        ← Database error types
    │   ├── users.rs        ← User CRUD
    │   └── tasks.rs        ← Task + comment CRUD
    └── models.rs           ← Shared data types
```

---

## Step 1: Project Setup

### Cargo.toml

```toml
[package]
name = "task-api"
version = "0.1.0"
edition = "2021"

[dependencies]
sqlx = { version = "0.8", features = [
    "runtime-tokio",
    "tls-rustls",
    "postgres",
    "macros",
    "migrate",
    "chrono",
    "uuid",
] }
tokio = { version = "1", features = ["full"] }
axum = "0.8"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
dotenvy = "0.15"
thiserror = "2"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
chrono = { version = "0.4", features = ["serde"] }
uuid = { version = "1", features = ["v4", "serde"] }
```

### .env

```bash
DATABASE_URL=postgres://your_user:your_password@localhost:5432/learn_db
```

---

## Step 2: Define the Schema

### Migration 1: Users

```sql
-- migrations/20240101000001_create_users.sql

CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users (email);
```

**Design decisions:**
- **UUID primary key** — avoids sequential ID enumeration, safe for APIs
- **TIMESTAMPTZ** not TIMESTAMP — always store timezone-aware timestamps
- **Separate `password_hash`** — never store plaintext passwords
- **`updated_at`** — track when the row last changed
- **Index on email** — email lookups are the most common query (login)

### Migration 2: Tasks

```sql
-- migrations/20240101000002_create_tasks.sql

CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'done', 'cancelled');

CREATE TABLE tasks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    description TEXT,
    status      task_status NOT NULL DEFAULT 'todo',
    due_date    DATE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_user_id ON tasks (user_id);
CREATE INDEX idx_tasks_status ON tasks (status);
CREATE INDEX idx_tasks_user_status ON tasks (user_id, status);
```

**Design decisions:**
- **Postgres ENUM** for status — enforces valid values at the database level
- **Foreign key with ON DELETE CASCADE** — deleting a user deletes their tasks
- **Composite index** on `(user_id, status)` — optimizes the most common
  query: "show me all in-progress tasks for this user"
- **Optional `description` and `due_date`** — nullable columns

### Migration 3: Task Comments

```sql
-- migrations/20240101000003_create_task_comments.sql

CREATE TABLE task_comments (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_task_comments_task_id ON task_comments (task_id);
```

### Run migrations

```bash
sqlx migrate run
```

---

## Step 3: Models

These structs are shared across the data layer and the API layer.

### src/models.rs

```rust
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub name: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateUser {
    pub email: String,
    pub name: String,
    pub password_hash: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateUser {
    pub email: Option<String>,
    pub name: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "task_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum TaskStatus {
    Todo,
    InProgress,
    Done,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct Task {
    pub id: Uuid,
    pub user_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub status: TaskStatus,
    pub due_date: Option<NaiveDate>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTask {
    pub title: String,
    pub description: Option<String>,
    pub due_date: Option<NaiveDate>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTask {
    pub title: Option<String>,
    pub description: Option<String>,
    pub due_date: Option<NaiveDate>,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct TaskComment {
    pub id: Uuid,
    pub task_id: Uuid,
    pub user_id: Uuid,
    pub body: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateComment {
    pub body: String,
}
```

**Key patterns:**
- **Separate Create/Update structs** from the database model. The `User`
  struct has all fields; `CreateUser` has only what you provide at creation
  time. This is the same pattern you'd use in Go (separate request/response
  types) or TypeScript (Pick/Omit utility types).
- **`#[serde(skip_serializing)]`** on `password_hash` — never send the
  hash in API responses.
- **`sqlx::Type`** derives the Postgres ENUM mapping. `rename_all = "snake_case"`
  maps Rust `InProgress` to Postgres `in_progress`.
- **`Option<T>`** for nullable columns: `description`, `due_date`.

---

## Step 4: Database Error Handling

### src/db/error.rs

```rust
use thiserror::Error;

#[derive(Debug, Error)]
pub enum DbError {
    #[error("record not found")]
    NotFound,

    #[error("duplicate record: {0}")]
    Duplicate(String),

    #[error("foreign key violation: {0}")]
    ForeignKeyViolation(String),

    #[error("invalid input: {0}")]
    InvalidInput(String),

    #[error("database error: {0}")]
    Internal(#[source] sqlx::Error),
}

impl From<sqlx::Error> for DbError {
    fn from(error: sqlx::Error) -> Self {
        match &error {
            sqlx::Error::RowNotFound => DbError::NotFound,
            sqlx::Error::Database(db_err) => {
                if db_err.is_unique_violation() {
                    let detail = db_err
                        .constraint()
                        .unwrap_or("unknown")
                        .to_string();
                    DbError::Duplicate(detail)
                } else if db_err.is_foreign_key_violation() {
                    let detail = db_err
                        .constraint()
                        .unwrap_or("unknown")
                        .to_string();
                    DbError::ForeignKeyViolation(detail)
                } else {
                    DbError::Internal(error)
                }
            }
            _ => DbError::Internal(error),
        }
    }
}

pub type DbResult<T> = Result<T, DbError>;
```

**Why this matters:**

Raw `sqlx::Error` leaks database implementation details into your application
logic. By converting to `DbError`, your HTTP handlers can match on
`NotFound`, `Duplicate`, etc. without knowing anything about sqlx.

**Go comparison:** In Go, you'd check `errors.Is(err, sql.ErrNoRows)` and
parse `pq.Error` codes. Same concept, but Rust's `match` on enum variants
is more ergonomic than Go's type assertions.

**TypeScript comparison:** Similar to mapping Prisma's `PrismaClientKnownRequestError`
codes (P2002 for unique, P2025 for not found) to your application error types.

---

## Step 5: Pool Setup and Migrations

### src/db/mod.rs

```rust
pub mod error;
pub mod tasks;
pub mod users;

use sqlx::postgres::{PgPool, PgPoolOptions};
use std::time::Duration;

pub async fn create_pool(database_url: &str) -> Result<PgPool, sqlx::Error> {
    let pool = PgPoolOptions::new()
        .max_connections(20)
        .min_connections(5)
        .acquire_timeout(Duration::from_secs(3))
        .idle_timeout(Duration::from_secs(600))
        .max_lifetime(Duration::from_secs(1800))
        .test_before_acquire(true)
        .connect(database_url)
        .await?;

    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed to run database migrations");

    tracing::info!("Database pool initialized, migrations applied");

    Ok(pool)
}

pub async fn check_health(pool: &PgPool) -> bool {
    sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(pool)
        .await
        .is_ok()
}
```

---

## Step 6: User Repository

### src/db/users.rs

```rust
use sqlx::PgPool;
use uuid::Uuid;

use crate::db::error::{DbError, DbResult};
use crate::models::{CreateUser, UpdateUser, User};

pub struct UserRepository<'a> {
    pool: &'a PgPool,
}

impl<'a> UserRepository<'a> {
    pub fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    pub async fn create(&self, input: &CreateUser) -> DbResult<User> {
        if input.email.is_empty() {
            return Err(DbError::InvalidInput("email cannot be empty".into()));
        }
        if input.name.is_empty() {
            return Err(DbError::InvalidInput("name cannot be empty".into()));
        }

        let user = sqlx::query_as::<_, User>(
            "INSERT INTO users (email, name, password_hash)
             VALUES ($1, $2, $3)
             RETURNING id, email, name, password_hash, created_at, updated_at"
        )
            .bind(&input.email)
            .bind(&input.name)
            .bind(&input.password_hash)
            .fetch_one(self.pool)
            .await?;

        Ok(user)
    }

    pub async fn get_by_id(&self, id: Uuid) -> DbResult<User> {
        let user = sqlx::query_as::<_, User>(
            "SELECT id, email, name, password_hash, created_at, updated_at
             FROM users
             WHERE id = $1"
        )
            .bind(id)
            .fetch_one(self.pool)
            .await?;

        Ok(user)
    }

    pub async fn get_by_email(&self, email: &str) -> DbResult<User> {
        let user = sqlx::query_as::<_, User>(
            "SELECT id, email, name, password_hash, created_at, updated_at
             FROM users
             WHERE email = $1"
        )
            .bind(email)
            .fetch_one(self.pool)
            .await?;

        Ok(user)
    }

    pub async fn list(&self, limit: i64, offset: i64) -> DbResult<Vec<User>> {
        let users = sqlx::query_as::<_, User>(
            "SELECT id, email, name, password_hash, created_at, updated_at
             FROM users
             ORDER BY created_at DESC
             LIMIT $1 OFFSET $2"
        )
            .bind(limit)
            .bind(offset)
            .fetch_all(self.pool)
            .await?;

        Ok(users)
    }

    pub async fn update(&self, id: Uuid, input: &UpdateUser) -> DbResult<User> {
        let existing = self.get_by_id(id).await?;

        let email = input.email.as_deref().unwrap_or(&existing.email);
        let name = input.name.as_deref().unwrap_or(&existing.name);

        let user = sqlx::query_as::<_, User>(
            "UPDATE users
             SET email = $1, name = $2, updated_at = NOW()
             WHERE id = $3
             RETURNING id, email, name, password_hash, created_at, updated_at"
        )
            .bind(email)
            .bind(name)
            .bind(id)
            .fetch_one(self.pool)
            .await?;

        Ok(user)
    }

    pub async fn delete(&self, id: Uuid) -> DbResult<()> {
        let result = sqlx::query("DELETE FROM users WHERE id = $1")
            .bind(id)
            .execute(self.pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(DbError::NotFound);
        }

        Ok(())
    }
}
```

**Pattern breakdown:**

1. **Repository struct holds a pool reference.** `&'a PgPool` means the
   repository borrows the pool — it doesn't own it. Multiple repositories
   share the same pool.

2. **Input validation before the query.** Catch obvious errors without
   hitting the database.

3. **`RETURNING` clause.** Every mutation returns the updated row, so
   callers always get fresh data.

4. **Partial updates with `UpdateUser`.** Only override fields that are
   `Some`. Fields that are `None` keep their existing values.

5. **Delete checks `rows_affected`.** If zero rows were deleted, the user
   didn't exist. Return `NotFound` instead of silently succeeding.

**Go comparison:** In Go you'd define a `UserStore` interface and a
`PostgresUserStore` struct. The pattern is identical — Go just uses
interfaces where Rust uses traits (though we're using a concrete struct
here for simplicity).

---

## Step 7: Task Repository

### src/db/tasks.rs

```rust
use sqlx::PgPool;
use uuid::Uuid;

use crate::db::error::{DbError, DbResult};
use crate::models::{
    CreateComment, CreateTask, Task, TaskComment, TaskStatus, UpdateTask,
};

pub struct TaskRepository<'a> {
    pool: &'a PgPool,
}

impl<'a> TaskRepository<'a> {
    pub fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    pub async fn create(&self, user_id: Uuid, input: &CreateTask) -> DbResult<Task> {
        if input.title.is_empty() {
            return Err(DbError::InvalidInput("title cannot be empty".into()));
        }

        let task = sqlx::query_as::<_, Task>(
            "INSERT INTO tasks (user_id, title, description, due_date)
             VALUES ($1, $2, $3, $4)
             RETURNING id, user_id, title, description, status,
                       due_date, created_at, updated_at"
        )
            .bind(user_id)
            .bind(&input.title)
            .bind(&input.description)
            .bind(input.due_date)
            .fetch_one(self.pool)
            .await?;

        Ok(task)
    }

    pub async fn get_by_id(&self, id: Uuid) -> DbResult<Task> {
        let task = sqlx::query_as::<_, Task>(
            "SELECT id, user_id, title, description, status,
                    due_date, created_at, updated_at
             FROM tasks
             WHERE id = $1"
        )
            .bind(id)
            .fetch_one(self.pool)
            .await?;

        Ok(task)
    }

    pub async fn list_by_user(
        &self,
        user_id: Uuid,
        status_filter: Option<TaskStatus>,
        limit: i64,
        offset: i64,
    ) -> DbResult<Vec<Task>> {
        let tasks = match status_filter {
            Some(status) => {
                sqlx::query_as::<_, Task>(
                    "SELECT id, user_id, title, description, status,
                            due_date, created_at, updated_at
                     FROM tasks
                     WHERE user_id = $1 AND status = $2
                     ORDER BY created_at DESC
                     LIMIT $3 OFFSET $4"
                )
                    .bind(user_id)
                    .bind(status)
                    .bind(limit)
                    .bind(offset)
                    .fetch_all(self.pool)
                    .await?
            }
            None => {
                sqlx::query_as::<_, Task>(
                    "SELECT id, user_id, title, description, status,
                            due_date, created_at, updated_at
                     FROM tasks
                     WHERE user_id = $1
                     ORDER BY created_at DESC
                     LIMIT $2 OFFSET $3"
                )
                    .bind(user_id)
                    .bind(limit)
                    .bind(offset)
                    .fetch_all(self.pool)
                    .await?
            }
        };

        Ok(tasks)
    }

    pub async fn update(&self, id: Uuid, input: &UpdateTask) -> DbResult<Task> {
        let existing = self.get_by_id(id).await?;

        let title = input.title.as_deref().unwrap_or(&existing.title);
        let description = match &input.description {
            Some(desc) => Some(desc.as_str()),
            None => existing.description.as_deref(),
        };
        let due_date = input.due_date.or(existing.due_date);

        let task = sqlx::query_as::<_, Task>(
            "UPDATE tasks
             SET title = $1, description = $2, due_date = $3, updated_at = NOW()
             WHERE id = $4
             RETURNING id, user_id, title, description, status,
                       due_date, created_at, updated_at"
        )
            .bind(title)
            .bind(description)
            .bind(due_date)
            .bind(id)
            .fetch_one(self.pool)
            .await?;

        Ok(task)
    }

    pub async fn update_status(&self, id: Uuid, status: TaskStatus) -> DbResult<Task> {
        let task = sqlx::query_as::<_, Task>(
            "UPDATE tasks
             SET status = $1, updated_at = NOW()
             WHERE id = $2
             RETURNING id, user_id, title, description, status,
                       due_date, created_at, updated_at"
        )
            .bind(status)
            .bind(id)
            .fetch_one(self.pool)
            .await?;

        Ok(task)
    }

    pub async fn delete(&self, id: Uuid) -> DbResult<()> {
        let result = sqlx::query("DELETE FROM tasks WHERE id = $1")
            .bind(id)
            .execute(self.pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(DbError::NotFound);
        }

        Ok(())
    }

    pub async fn add_comment(
        &self,
        task_id: Uuid,
        user_id: Uuid,
        input: &CreateComment,
    ) -> DbResult<TaskComment> {
        if input.body.is_empty() {
            return Err(DbError::InvalidInput("comment body cannot be empty".into()));
        }

        self.get_by_id(task_id).await?;

        let comment = sqlx::query_as::<_, TaskComment>(
            "INSERT INTO task_comments (task_id, user_id, body)
             VALUES ($1, $2, $3)
             RETURNING id, task_id, user_id, body, created_at"
        )
            .bind(task_id)
            .bind(user_id)
            .bind(&input.body)
            .fetch_one(self.pool)
            .await?;

        Ok(comment)
    }

    pub async fn list_comments(
        &self,
        task_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> DbResult<Vec<TaskComment>> {
        let comments = sqlx::query_as::<_, TaskComment>(
            "SELECT id, task_id, user_id, body, created_at
             FROM task_comments
             WHERE task_id = $1
             ORDER BY created_at ASC
             LIMIT $2 OFFSET $3"
        )
            .bind(task_id)
            .bind(limit)
            .bind(offset)
            .fetch_all(self.pool)
            .await?;

        Ok(comments)
    }

    pub async fn reassign_all(
        &self,
        from_user_id: Uuid,
        to_user_id: Uuid,
    ) -> DbResult<u64> {
        let mut tx = self.pool.begin().await.map_err(DbError::Internal)?;

        sqlx::query(
            "SELECT id FROM users WHERE id = $1"
        )
            .bind(to_user_id)
            .fetch_one(&mut *tx)
            .await
            .map_err(|_| DbError::NotFound)?;

        let result = sqlx::query(
            "UPDATE tasks SET user_id = $1, updated_at = NOW() WHERE user_id = $2"
        )
            .bind(to_user_id)
            .bind(from_user_id)
            .execute(&mut *tx)
            .await
            .map_err(DbError::Internal)?;

        tx.commit().await.map_err(DbError::Internal)?;

        Ok(result.rows_affected())
    }
}
```

**Patterns worth noting:**

1. **`list_by_user` with optional filter.** Instead of building dynamic SQL,
   we use two separate queries. This keeps things simple and both queries
   can be prepared and cached. For more complex filtering you'd use
   `QueryBuilder`.

2. **`reassign_all` uses a transaction.** Verifying the target user exists
   and reassigning tasks must be atomic. If the target user doesn't exist,
   the transaction rolls back.

3. **`add_comment` checks the task exists first.** Without this, you'd get
   a foreign key violation error. Checking first gives a better error
   message (`NotFound` vs a cryptic constraint name).

4. **Comments ordered ASC.** Tasks have newest-first; comments have
   oldest-first (chronological conversation order).

---

## Step 8: Integration with axum

### src/main.rs

```rust
mod db;
mod models;

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{delete, get, patch, post},
    Json, Router,
};
use serde::Deserialize;
use sqlx::PgPool;
use tracing_subscriber::EnvFilter;
use uuid::Uuid;

use crate::db::error::DbError;
use crate::db::tasks::TaskRepository;
use crate::db::users::UserRepository;
use crate::models::*;

impl IntoResponse for DbError {
    fn into_response(self) -> axum::response::Response {
        let (status, message) = match &self {
            DbError::NotFound => (StatusCode::NOT_FOUND, self.to_string()),
            DbError::Duplicate(_) => (StatusCode::CONFLICT, self.to_string()),
            DbError::ForeignKeyViolation(_) => {
                (StatusCode::BAD_REQUEST, self.to_string())
            }
            DbError::InvalidInput(_) => {
                (StatusCode::UNPROCESSABLE_ENTITY, self.to_string())
            }
            DbError::Internal(e) => {
                tracing::error!("Internal database error: {}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "internal server error".to_string(),
                )
            }
        };

        let body = serde_json::json!({ "error": message });
        (status, Json(body)).into_response()
    }
}

#[derive(Debug, Deserialize)]
struct PaginationParams {
    limit: Option<i64>,
    offset: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct TaskFilterParams {
    status: Option<TaskStatus>,
    limit: Option<i64>,
    offset: Option<i64>,
}

async fn create_user_handler(
    State(pool): State<PgPool>,
    Json(input): Json<CreateUser>,
) -> Result<(StatusCode, Json<User>), DbError> {
    let repo = UserRepository::new(&pool);
    let user = repo.create(&input).await?;
    Ok((StatusCode::CREATED, Json(user)))
}

async fn get_user_handler(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<User>, DbError> {
    let repo = UserRepository::new(&pool);
    let user = repo.get_by_id(id).await?;
    Ok(Json(user))
}

async fn list_users_handler(
    State(pool): State<PgPool>,
    Query(params): Query<PaginationParams>,
) -> Result<Json<Vec<User>>, DbError> {
    let repo = UserRepository::new(&pool);
    let users = repo.list(
        params.limit.unwrap_or(50),
        params.offset.unwrap_or(0),
    ).await?;
    Ok(Json(users))
}

async fn update_user_handler(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateUser>,
) -> Result<Json<User>, DbError> {
    let repo = UserRepository::new(&pool);
    let user = repo.update(id, &input).await?;
    Ok(Json(user))
}

async fn delete_user_handler(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, DbError> {
    let repo = UserRepository::new(&pool);
    repo.delete(id).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn create_task_handler(
    State(pool): State<PgPool>,
    Path(user_id): Path<Uuid>,
    Json(input): Json<CreateTask>,
) -> Result<(StatusCode, Json<Task>), DbError> {
    let repo = TaskRepository::new(&pool);
    let task = repo.create(user_id, &input).await?;
    Ok((StatusCode::CREATED, Json(task)))
}

async fn get_task_handler(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<Task>, DbError> {
    let repo = TaskRepository::new(&pool);
    let task = repo.get_by_id(id).await?;
    Ok(Json(task))
}

async fn list_user_tasks_handler(
    State(pool): State<PgPool>,
    Path(user_id): Path<Uuid>,
    Query(params): Query<TaskFilterParams>,
) -> Result<Json<Vec<Task>>, DbError> {
    let repo = TaskRepository::new(&pool);
    let tasks = repo.list_by_user(
        user_id,
        params.status,
        params.limit.unwrap_or(50),
        params.offset.unwrap_or(0),
    ).await?;
    Ok(Json(tasks))
}

async fn update_task_handler(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateTask>,
) -> Result<Json<Task>, DbError> {
    let repo = TaskRepository::new(&pool);
    let task = repo.update(id, &input).await?;
    Ok(Json(task))
}

async fn update_task_status_handler(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
    Json(status): Json<TaskStatus>,
) -> Result<Json<Task>, DbError> {
    let repo = TaskRepository::new(&pool);
    let task = repo.update_status(id, status).await?;
    Ok(Json(task))
}

async fn delete_task_handler(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, DbError> {
    let repo = TaskRepository::new(&pool);
    repo.delete(id).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn add_comment_handler(
    State(pool): State<PgPool>,
    Path((task_id, user_id)): Path<(Uuid, Uuid)>,
    Json(input): Json<CreateComment>,
) -> Result<(StatusCode, Json<TaskComment>), DbError> {
    let repo = TaskRepository::new(&pool);
    let comment = repo.add_comment(task_id, user_id, &input).await?;
    Ok((StatusCode::CREATED, Json(comment)))
}

async fn list_comments_handler(
    State(pool): State<PgPool>,
    Path(task_id): Path<Uuid>,
    Query(params): Query<PaginationParams>,
) -> Result<Json<Vec<TaskComment>>, DbError> {
    let repo = TaskRepository::new(&pool);
    let comments = repo.list_comments(
        task_id,
        params.limit.unwrap_or(50),
        params.offset.unwrap_or(0),
    ).await?;
    Ok(Json(comments))
}

async fn health_handler(State(pool): State<PgPool>) -> impl IntoResponse {
    if db::check_health(&pool).await {
        (StatusCode::OK, "healthy")
    } else {
        (StatusCode::SERVICE_UNAVAILABLE, "unhealthy")
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("info,sqlx=warn")),
        )
        .init();

    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set");

    let pool = db::create_pool(&database_url).await?;

    let app = Router::new()
        .route("/health", get(health_handler))
        .route("/users", post(create_user_handler))
        .route("/users", get(list_users_handler))
        .route("/users/{id}", get(get_user_handler))
        .route("/users/{id}", patch(update_user_handler))
        .route("/users/{id}", delete(delete_user_handler))
        .route("/users/{user_id}/tasks", post(create_task_handler))
        .route("/users/{user_id}/tasks", get(list_user_tasks_handler))
        .route("/tasks/{id}", get(get_task_handler))
        .route("/tasks/{id}", patch(update_task_handler))
        .route("/tasks/{id}/status", patch(update_task_status_handler))
        .route("/tasks/{id}", delete(delete_task_handler))
        .route(
            "/tasks/{task_id}/comments/by/{user_id}",
            post(add_comment_handler),
        )
        .route("/tasks/{task_id}/comments", get(list_comments_handler))
        .with_state(pool);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
    tracing::info!("Server listening on http://localhost:3000");
    axum::serve(listener, app).await?;

    Ok(())
}
```

**How the data layer integrates with axum:**

1. **`PgPool` is the shared state.** axum's `State` extractor gives every
   handler access to the pool.

2. **Repositories are created per-request.** `UserRepository::new(&pool)`
   borrows the pool for the duration of the handler. Cheap — it's just
   storing a reference.

3. **`DbError` implements `IntoResponse`.** axum can convert your database
   errors directly into HTTP responses. `NotFound` becomes 404, `Duplicate`
   becomes 409, `Internal` becomes 500.

4. **Internal errors are logged, not exposed.** The 500 response says
   "internal server error" — the actual sqlx error is logged server-side
   but never sent to the client.

**Go comparison:** In Go with `chi` or `gin`, you'd pass a `*sql.DB` via
middleware or struct embedding. The pattern is identical: pool in shared
state, repository per request, error mapping in the handler.

---

## Step 9: Testing the Data Layer

### Test setup

Create a test database:

```bash
createdb learn_db_test
```

Add to `.env.test`:

```bash
DATABASE_URL=postgres://your_user:your_password@localhost:5432/learn_db_test
```

### Integration tests

Create `tests/db_tests.rs`:

```rust
use sqlx::PgPool;
use task_api::db;
use task_api::db::tasks::TaskRepository;
use task_api::db::users::UserRepository;
use task_api::models::*;

async fn setup_pool() -> PgPool {
    dotenvy::from_filename(".env.test").ok();
    let url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = db::create_pool(&url).await.expect("Failed to create pool");
    cleanup(&pool).await;
    pool
}

async fn cleanup(pool: &PgPool) {
    sqlx::query("DELETE FROM task_comments").execute(pool).await.unwrap();
    sqlx::query("DELETE FROM tasks").execute(pool).await.unwrap();
    sqlx::query("DELETE FROM users").execute(pool).await.unwrap();
}

fn test_create_user_input() -> CreateUser {
    CreateUser {
        email: format!("test-{}@example.com", uuid::Uuid::new_v4()),
        name: "Test User".to_string(),
        password_hash: "hashed_password_123".to_string(),
    }
}

#[tokio::test]
async fn test_create_and_get_user() {
    let pool = setup_pool().await;
    let repo = UserRepository::new(&pool);

    let input = test_create_user_input();
    let created = repo.create(&input).await.unwrap();

    assert_eq!(created.email, input.email);
    assert_eq!(created.name, input.name);

    let fetched = repo.get_by_id(created.id).await.unwrap();
    assert_eq!(fetched.id, created.id);
    assert_eq!(fetched.email, created.email);
}

#[tokio::test]
async fn test_get_user_by_email() {
    let pool = setup_pool().await;
    let repo = UserRepository::new(&pool);

    let input = test_create_user_input();
    let created = repo.create(&input).await.unwrap();

    let fetched = repo.get_by_email(&input.email).await.unwrap();
    assert_eq!(fetched.id, created.id);
}

#[tokio::test]
async fn test_duplicate_email_returns_error() {
    let pool = setup_pool().await;
    let repo = UserRepository::new(&pool);

    let input = test_create_user_input();
    repo.create(&input).await.unwrap();

    let result = repo.create(&input).await;
    assert!(matches!(result, Err(db::error::DbError::Duplicate(_))));
}

#[tokio::test]
async fn test_update_user() {
    let pool = setup_pool().await;
    let repo = UserRepository::new(&pool);

    let input = test_create_user_input();
    let created = repo.create(&input).await.unwrap();

    let update = UpdateUser {
        email: None,
        name: Some("Updated Name".to_string()),
    };
    let updated = repo.update(created.id, &update).await.unwrap();

    assert_eq!(updated.name, "Updated Name");
    assert_eq!(updated.email, created.email);
}

#[tokio::test]
async fn test_delete_user() {
    let pool = setup_pool().await;
    let repo = UserRepository::new(&pool);

    let input = test_create_user_input();
    let created = repo.create(&input).await.unwrap();

    repo.delete(created.id).await.unwrap();

    let result = repo.get_by_id(created.id).await;
    assert!(matches!(result, Err(db::error::DbError::NotFound)));
}

#[tokio::test]
async fn test_delete_nonexistent_user_returns_not_found() {
    let pool = setup_pool().await;
    let repo = UserRepository::new(&pool);

    let result = repo.delete(uuid::Uuid::new_v4()).await;
    assert!(matches!(result, Err(db::error::DbError::NotFound)));
}

#[tokio::test]
async fn test_create_and_list_tasks() {
    let pool = setup_pool().await;
    let user_repo = UserRepository::new(&pool);
    let task_repo = TaskRepository::new(&pool);

    let user_input = test_create_user_input();
    let user = user_repo.create(&user_input).await.unwrap();

    let task_input = CreateTask {
        title: "Write tests".to_string(),
        description: Some("Integration tests for the data layer".to_string()),
        due_date: None,
    };
    let task = task_repo.create(user.id, &task_input).await.unwrap();

    assert_eq!(task.title, "Write tests");
    assert_eq!(task.status, TaskStatus::Todo);
    assert_eq!(task.user_id, user.id);

    let tasks = task_repo.list_by_user(user.id, None, 50, 0).await.unwrap();
    assert_eq!(tasks.len(), 1);
    assert_eq!(tasks[0].id, task.id);
}

#[tokio::test]
async fn test_update_task_status() {
    let pool = setup_pool().await;
    let user_repo = UserRepository::new(&pool);
    let task_repo = TaskRepository::new(&pool);

    let user = user_repo.create(&test_create_user_input()).await.unwrap();

    let task_input = CreateTask {
        title: "Status test".to_string(),
        description: None,
        due_date: None,
    };
    let task = task_repo.create(user.id, &task_input).await.unwrap();
    assert_eq!(task.status, TaskStatus::Todo);

    let updated = task_repo.update_status(task.id, TaskStatus::InProgress).await.unwrap();
    assert_eq!(updated.status, TaskStatus::InProgress);

    let done = task_repo.update_status(task.id, TaskStatus::Done).await.unwrap();
    assert_eq!(done.status, TaskStatus::Done);
}

#[tokio::test]
async fn test_filter_tasks_by_status() {
    let pool = setup_pool().await;
    let user_repo = UserRepository::new(&pool);
    let task_repo = TaskRepository::new(&pool);

    let user = user_repo.create(&test_create_user_input()).await.unwrap();

    for title in ["Task A", "Task B", "Task C"] {
        let input = CreateTask {
            title: title.to_string(),
            description: None,
            due_date: None,
        };
        task_repo.create(user.id, &input).await.unwrap();
    }

    let all = task_repo.list_by_user(user.id, None, 50, 0).await.unwrap();
    assert_eq!(all.len(), 3);

    task_repo.update_status(all[0].id, TaskStatus::InProgress).await.unwrap();

    let in_progress = task_repo
        .list_by_user(user.id, Some(TaskStatus::InProgress), 50, 0)
        .await
        .unwrap();
    assert_eq!(in_progress.len(), 1);

    let todo = task_repo
        .list_by_user(user.id, Some(TaskStatus::Todo), 50, 0)
        .await
        .unwrap();
    assert_eq!(todo.len(), 2);
}

#[tokio::test]
async fn test_task_comments() {
    let pool = setup_pool().await;
    let user_repo = UserRepository::new(&pool);
    let task_repo = TaskRepository::new(&pool);

    let user = user_repo.create(&test_create_user_input()).await.unwrap();

    let task_input = CreateTask {
        title: "Comment test".to_string(),
        description: None,
        due_date: None,
    };
    let task = task_repo.create(user.id, &task_input).await.unwrap();

    let comment1 = task_repo
        .add_comment(task.id, user.id, &CreateComment { body: "First comment".into() })
        .await
        .unwrap();
    let comment2 = task_repo
        .add_comment(task.id, user.id, &CreateComment { body: "Second comment".into() })
        .await
        .unwrap();

    assert_eq!(comment1.body, "First comment");
    assert_eq!(comment2.body, "Second comment");

    let comments = task_repo.list_comments(task.id, 50, 0).await.unwrap();
    assert_eq!(comments.len(), 2);
    assert_eq!(comments[0].body, "First comment");
    assert_eq!(comments[1].body, "Second comment");
}

#[tokio::test]
async fn test_cascade_delete_user_removes_tasks() {
    let pool = setup_pool().await;
    let user_repo = UserRepository::new(&pool);
    let task_repo = TaskRepository::new(&pool);

    let user = user_repo.create(&test_create_user_input()).await.unwrap();

    let task_input = CreateTask {
        title: "Will be deleted".to_string(),
        description: None,
        due_date: None,
    };
    let task = task_repo.create(user.id, &task_input).await.unwrap();

    user_repo.delete(user.id).await.unwrap();

    let result = task_repo.get_by_id(task.id).await;
    assert!(matches!(result, Err(db::error::DbError::NotFound)));
}
```

### Running the tests

```bash
DATABASE_URL=postgres://your_user@localhost:5432/learn_db_test cargo test
```

**Testing patterns:**

1. **Separate test database.** Never test against your development database.
   Tests delete data.

2. **Cleanup at the start of each test.** Delete in reverse dependency
   order (comments, tasks, users). Cleaning at the start (not the end)
   means a crashed test doesn't leave dirty state for the next run.

3. **Unique emails per test.** Using `uuid::Uuid::new_v4()` in email
   addresses prevents collision between parallel tests.

4. **Test both success and error paths.** Verify that duplicates return
   `Duplicate`, not-found returns `NotFound`, and cascade deletes actually
   cascade.

**Go comparison:** Go uses `TestMain` with `t.Cleanup` and test containers.
The pattern is the same: isolated database, cleanup between tests, test
both happy and error paths.

---

## Architecture Summary

```
HTTP Request
     │
     ▼
┌──────────┐
│   axum   │  Extracts JSON, path params, query params
│ handler  │  Knows about HTTP, not about SQL
└────┬─────┘
     │ calls
     ▼
┌──────────┐
│ Repo     │  UserRepository, TaskRepository
│ (db/)    │  Knows about SQL, not about HTTP
└────┬─────┘
     │ uses
     ▼
┌──────────┐
│  PgPool  │  Connection pool (shared via axum State)
│  (sqlx)  │
└────┬─────┘
     │
     ▼
  Postgres
```

**Separation of concerns:**
- **Handlers** know HTTP (status codes, JSON) but not SQL
- **Repositories** know SQL but not HTTP
- **Models** are shared between both layers
- **DbError** is the bridge — repositories produce it, handlers convert
  it to HTTP responses

This means you can:
- Replace axum with actix-web without touching the data layer
- Replace Postgres with SQLite by swapping the repository implementations
- Test the data layer without an HTTP server
- Test the handlers with mock repositories (using traits)

---

## Exercises

### Exercise 1: Add a Tags System

Extend the project with a many-to-many tags relationship:

1. Create a migration for a `tags` table and a `task_tags` junction table
2. Add these repository methods:
   - `create_tag(name) -> Tag`
   - `add_tag_to_task(task_id, tag_id)`
   - `remove_tag_from_task(task_id, tag_id)`
   - `list_tags_for_task(task_id) -> Vec<Tag>`
   - `list_tasks_by_tag(tag_id) -> Vec<Task>`
3. Add corresponding axum handlers
4. Write tests for all of the above

### Exercise 2: Search

Add a full-text search endpoint for tasks:

```
GET /tasks/search?q=deployment&user_id=<uuid>
```

1. Add a GIN index for full-text search on `title` and `description`
2. Implement the repository method using `to_tsvector` and `plainto_tsquery`
3. Return results ranked by relevance

Hint: the migration looks like:

```sql
ALTER TABLE tasks ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
        to_tsvector('english', title || ' ' || COALESCE(description, ''))
    ) STORED;

CREATE INDEX idx_tasks_search ON tasks USING GIN (search_vector);
```

### Exercise 3: Soft Deletes

Modify the task system to use soft deletes instead of hard deletes:

1. Add a `deleted_at TIMESTAMPTZ` column to `tasks`
2. Change `delete` to set `deleted_at = NOW()` instead of deleting the row
3. Change all queries to filter out `WHERE deleted_at IS NULL`
4. Add a `restore` method that sets `deleted_at = NULL`
5. Add a `purge` method that actually deletes soft-deleted tasks older
   than 30 days

### Exercise 4: Pagination Cursors

Replace offset-based pagination with cursor-based pagination:

Instead of `?limit=20&offset=40`, use `?limit=20&after=<last_id>`.

1. Implement cursor pagination for `list_by_user`
2. Return a response like:

```json
{
  "data": [...],
  "next_cursor": "uuid-of-last-item",
  "has_more": true
}
```

Why is cursor pagination better for large datasets? (Hint: think about
what `OFFSET 100000` does internally.)

### Exercise 5: Repository Trait

Refactor `UserRepository` into a trait for testability:

```rust
#[async_trait]
pub trait UserRepo: Send + Sync {
    async fn create(&self, input: &CreateUser) -> DbResult<User>;
    async fn get_by_id(&self, id: Uuid) -> DbResult<User>;
    async fn get_by_email(&self, email: &str) -> DbResult<User>;
    async fn list(&self, limit: i64, offset: i64) -> DbResult<Vec<User>>;
    async fn update(&self, id: Uuid, input: &UpdateUser) -> DbResult<User>;
    async fn delete(&self, id: Uuid) -> DbResult<()>;
}
```

1. Implement `UserRepo` for `PgUserRepository`
2. Create a `MockUserRepository` for handler tests
3. Change axum handlers to accept `Arc<dyn UserRepo>` instead of `PgPool`
4. Write handler tests using the mock

---

## What's Next

You've built a complete, production-grade data layer in Rust. Here's where
to go from here:

**Deepen your Rust + database skills:**
- [sqlx documentation](https://docs.rs/sqlx/latest/sqlx/) — the full API
  reference
- [Postgres documentation](https://www.postgresql.org/docs/current/) —
  the authoritative reference for everything Postgres
- [Zero To Production In Rust](https://www.zero2prod.com/) — a book that
  builds a production email newsletter service with axum + sqlx

**Topics we didn't cover (but you should explore):**
- **PgBouncer** — external connection pooler, essential when you have many
  application instances sharing one Postgres server
- **Read replicas** — scaling reads by routing SELECT queries to replicas
- **Row-level security (RLS)** — Postgres can enforce access control at the
  database level
- **LISTEN/NOTIFY** — Postgres pub/sub for real-time features (sqlx supports
  this via `PgListener`)
- **Time-series data** — TimescaleDB extension for Postgres
- **Database ORMs** — SeaORM and Diesel, if you want higher-level abstractions

**Related tools worth knowing:**
- `cargo sqlx prepare` — offline mode for CI builds
- `pgcli` — a better `psql` with autocomplete
- `pgAdmin` or `DBeaver` — GUI database tools
- `pg_stat_statements` — track query performance across your application

You now have the knowledge to build data layers that are correct (compile-time
checked SQL), safe (parameterized queries, proper error handling), and fast
(connection pooling, batch operations, streaming). That's a strong foundation
for any Rust backend project.
