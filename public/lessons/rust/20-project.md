# Lesson 20: Putting It All Together

Build a complete Rust application that combines everything from the previous
lessons. This is a practical TODO API with CLI management.

---

## Project: Task Manager (API + CLI)

Features:
- REST API for CRUD operations (axum)
- CLI for quick task management (clap)
- JSON persistence (serde)
- Error handling (thiserror + anyhow)
- Proper module structure
- Tests

---

## Project Structure

```
task-manager/
├── Cargo.toml
├── src/
│   ├── main.rs          # entry point (CLI or server mode)
│   ├── cli.rs           # CLI argument parsing
│   ├── server.rs        # HTTP server setup
│   ├── handlers.rs      # request handlers
│   ├── models.rs        # data types
│   ├── store.rs         # data persistence
│   └── error.rs         # error types
└── tests/
    └── integration.rs   # integration tests
```

---

## Step 1: Dependencies

```toml
[package]
name = "task-manager"
version = "0.1.0"
edition = "2021"

[dependencies]
axum = "0.8"
clap = { version = "4", features = ["derive"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
thiserror = "2"
anyhow = "1"
chrono = { version = "0.4", features = ["serde"] }
uuid = { version = "1", features = ["v4", "serde"] }
```

---

## Step 2: Models (`src/models.rs`)

```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub status: TaskStatus,
    pub priority: Priority,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TaskStatus {
    Pending,
    InProgress,
    Done,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, clap::ValueEnum)]
#[serde(rename_all = "lowercase")]
pub enum Priority {
    Low,
    Medium,
    High,
}

#[derive(Debug, Deserialize)]
pub struct CreateTask {
    pub title: String,
    pub description: Option<String>,
    pub priority: Option<Priority>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTask {
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<TaskStatus>,
    pub priority: Option<Priority>,
}

impl Task {
    pub fn new(input: CreateTask) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            title: input.title,
            description: input.description,
            status: TaskStatus::Pending,
            priority: input.priority.unwrap_or(Priority::Medium),
            created_at: now,
            updated_at: now,
        }
    }

    pub fn apply_update(&mut self, update: UpdateTask) {
        if let Some(title) = update.title {
            self.title = title;
        }
        if let Some(desc) = update.description {
            self.description = Some(desc);
        }
        if let Some(status) = update.status {
            self.status = status;
        }
        if let Some(priority) = update.priority {
            self.priority = priority;
        }
        self.updated_at = Utc::now();
    }
}

impl std::fmt::Display for TaskStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TaskStatus::Pending => write!(f, "pending"),
            TaskStatus::InProgress => write!(f, "in-progress"),
            TaskStatus::Done => write!(f, "done"),
        }
    }
}

impl std::fmt::Display for Priority {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Priority::Low => write!(f, "low"),
            Priority::Medium => write!(f, "medium"),
            Priority::High => write!(f, "high"),
        }
    }
}
```

---

## Step 3: Error Types (`src/error.rs`)

```rust
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("task not found: {0}")]
    NotFound(String),

    #[error("bad request: {0}")]
    BadRequest(String),

    #[error("storage error: {0}")]
    Storage(#[from] std::io::Error),

    #[error("serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
}

#[derive(Serialize)]
struct ErrorBody {
    error: String,
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match &self {
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, msg.clone()),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg.clone()),
            AppError::Storage(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
            AppError::Serialization(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        };
        (status, Json(ErrorBody { error: message })).into_response()
    }
}
```

---

## Step 4: Store (`src/store.rs`)

```rust
use crate::error::AppError;
use crate::models::{CreateTask, Task, UpdateTask};
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

#[derive(Clone)]
pub struct TaskStore {
    tasks: Arc<Mutex<Vec<Task>>>,
}

impl TaskStore {
    pub fn new() -> Self {
        Self {
            tasks: Arc::new(Mutex::new(Vec::new())),
        }
    }

    pub async fn list(&self) -> Vec<Task> {
        self.tasks.lock().await.clone()
    }

    pub async fn get(&self, id: Uuid) -> Result<Task, AppError> {
        self.tasks
            .lock()
            .await
            .iter()
            .find(|t| t.id == id)
            .cloned()
            .ok_or_else(|| AppError::NotFound(id.to_string()))
    }

    pub async fn create(&self, input: CreateTask) -> Task {
        let task = Task::new(input);
        self.tasks.lock().await.push(task.clone());
        task
    }

    pub async fn update(&self, id: Uuid, update: UpdateTask) -> Result<Task, AppError> {
        let mut tasks = self.tasks.lock().await;
        let task = tasks
            .iter_mut()
            .find(|t| t.id == id)
            .ok_or_else(|| AppError::NotFound(id.to_string()))?;
        task.apply_update(update);
        Ok(task.clone())
    }

    pub async fn delete(&self, id: Uuid) -> Result<Task, AppError> {
        let mut tasks = self.tasks.lock().await;
        let pos = tasks
            .iter()
            .position(|t| t.id == id)
            .ok_or_else(|| AppError::NotFound(id.to_string()))?;
        Ok(tasks.remove(pos))
    }
}
```

---

## Step 5: Handlers (`src/handlers.rs`)

```rust
use crate::error::AppError;
use crate::models::{CreateTask, UpdateTask};
use crate::store::TaskStore;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use uuid::Uuid;

pub async fn list_tasks(State(store): State<TaskStore>) -> Json<serde_json::Value> {
    let tasks = store.list().await;
    Json(serde_json::json!({ "tasks": tasks, "count": tasks.len() }))
}

pub async fn get_task(
    State(store): State<TaskStore>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let task = store.get(id).await?;
    Ok(Json(serde_json::json!({ "task": task })))
}

pub async fn create_task(
    State(store): State<TaskStore>,
    Json(input): Json<CreateTask>,
) -> (StatusCode, Json<serde_json::Value>) {
    let task = store.create(input).await;
    (
        StatusCode::CREATED,
        Json(serde_json::json!({ "task": task })),
    )
}

pub async fn update_task(
    State(store): State<TaskStore>,
    Path(id): Path<Uuid>,
    Json(update): Json<UpdateTask>,
) -> Result<Json<serde_json::Value>, AppError> {
    let task = store.update(id, update).await?;
    Ok(Json(serde_json::json!({ "task": task })))
}

pub async fn delete_task(
    State(store): State<TaskStore>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let task = store.delete(id).await?;
    Ok(Json(serde_json::json!({ "deleted": task })))
}
```

---

## Step 6: Server (`src/server.rs`)

```rust
use crate::handlers;
use crate::store::TaskStore;
use axum::routing::{get, post};
use axum::Router;

pub async fn run(port: u16) -> anyhow::Result<()> {
    let store = TaskStore::new();

    let app = Router::new()
        .route("/health", get(|| async { "OK" }))
        .route("/tasks", get(handlers::list_tasks).post(handlers::create_task))
        .route(
            "/tasks/{id}",
            get(handlers::get_task)
                .put(handlers::update_task)
                .delete(handlers::delete_task),
        )
        .with_state(store);

    let addr = format!("0.0.0.0:{port}");
    println!("Server running on http://{addr}");

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
```

---

## Step 7: CLI (`src/cli.rs`)

```rust
use clap::{Parser, Subcommand};
use crate::models::Priority;

#[derive(Parser)]
#[command(name = "task-manager", about = "Task management API and CLI")]
pub struct Cli {
    #[command(subcommand)]
    pub command: Commands,
}

#[derive(Subcommand)]
pub enum Commands {
    /// Start the HTTP server
    Serve {
        #[arg(short, long, default_value_t = 3000)]
        port: u16,
    },

    /// Add a task (sends to running server)
    Add {
        title: String,

        #[arg(short, long)]
        description: Option<String>,

        #[arg(short, long, default_value = "medium")]
        priority: Priority,
    },

    /// List all tasks
    List,
}
```

---

## Step 8: Main (`src/main.rs`)

```rust
mod cli;
mod error;
mod handlers;
mod models;
mod server;
mod store;

use clap::Parser;
use cli::{Cli, Commands};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Serve { port } => {
            server::run(port).await?;
        }
        Commands::Add { title, description, priority } => {
            println!("Adding task: {title} (priority: {priority})");
            println!("Hint: In a real app, this would HTTP POST to the server");
        }
        Commands::List => {
            println!("Listing tasks...");
            println!("Hint: In a real app, this would HTTP GET from the server");
        }
    }

    Ok(())
}
```

---

## What This Project Exercises

| Concept | Where it's used |
|---------|----------------|
| Ownership & borrowing | Store methods, handler params |
| Enums with data | TaskStatus, Priority, AppError |
| Pattern matching | CLI commands, error handling |
| Traits | Display, IntoResponse, Serialize/Deserialize |
| Generics | `Json<T>`, `Result<T, AppError>` |
| Error handling | thiserror + `?` operator |
| Modules | Clean file structure |
| Async/await | All handlers, store operations |
| Smart pointers | `Arc<Mutex<Vec<Task>>>` in store |
| Serde | JSON request/response |
| Closures | Iterator chains in store |

---

## Next Steps After This Course

1. **Add a real database** — `sqlx` (async) or `diesel` (sync)
2. **Add authentication** — JWT with `jsonwebtoken` crate
3. **Add tests** — integration tests for API endpoints
4. **Deploy** — build a Docker image, deploy to fly.io
5. **Explore the ecosystem:**
   - `reqwest` — HTTP client
   - `tracing` — structured logging
   - `sqlx` — async SQL
   - `sea-orm` — ORM
   - `tower` — middleware framework
   - `tonic` — gRPC

---

## You Made It

You now have the mental model to read and write Rust. The compiler is your
pair programmer — trust its error messages, they're the best in any language.

The key concepts that make Rust different:
1. **Ownership** — each value has one owner
2. **Borrowing** — references without ownership transfer
3. **Lifetimes** — compiler-verified reference validity
4. **Enums with data** — type-safe state machines
5. **Traits** — interfaces with superpowers
6. **Zero-cost abstractions** — high-level code, low-level performance

Keep building. The more you fight the compiler, the more you learn.
Eventually, you'll think in ownership naturally.
