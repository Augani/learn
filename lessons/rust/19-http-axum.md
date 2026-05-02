# Lesson 19: HTTP API with Axum

Axum is a popular Rust web framework built on top of tokio. It gives you a
clean way to define routes, parse requests, manage shared state, and return
typed responses.

---

## Setup

```bash
cargo add axum
cargo add tokio --features full
cargo add serde --features derive
cargo add serde_json
cargo add tower-http --features cors
```

---

## Hello World Server

```rust
use axum::{routing::get, Router};

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/", get(root))
        .route("/health", get(health));

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    println!("Listening on http://localhost:3000");
    axum::serve(listener, app).await.unwrap();
}

async fn root() -> &'static str {
    "Hello, World!"
}

async fn health() -> &'static str {
    "OK"
}
```

**Go equivalent:**
```go
http.HandleFunc("/", rootHandler)
http.HandleFunc("/health", healthHandler)
http.ListenAndServe(":3000", nil)
```

---

## JSON Request and Response

```rust
use axum::{
    extract::Path,
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
struct User {
    id: u64,
    name: String,
    email: String,
}

#[derive(Deserialize)]
struct CreateUser {
    name: String,
    email: String,
}

#[derive(Serialize)]
struct ApiResponse<T: Serialize> {
    success: bool,
    data: T,
}

async fn get_user(Path(id): Path<u64>) -> Json<ApiResponse<User>> {
    let user = User {
        id,
        name: "Augustus".to_string(),
        email: "aug@example.com".to_string(),
    };

    Json(ApiResponse {
        success: true,
        data: user,
    })
}

async fn create_user(Json(payload): Json<CreateUser>) -> (StatusCode, Json<ApiResponse<User>>) {
    let user = User {
        id: 1,
        name: payload.name,
        email: payload.email,
    };

    (
        StatusCode::CREATED,
        Json(ApiResponse {
            success: true,
            data: user,
        }),
    )
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/users/{id}", get(get_user))
        .route("/users", post(create_user));

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
```

**Go equivalent:**
```go
func getUser(w http.ResponseWriter, r *http.Request) {
    id := chi.URLParam(r, "id")
    json.NewEncoder(w).Encode(user)
}
```

Axum uses **extractors** (`Path`, `Json`, `Query`) to pull data from
requests. The function signature IS the API contract.

---

## Extractors

```rust
use axum::extract::{Path, Query, State, Json};
use serde::Deserialize;

// Path parameters: /users/42
async fn get_user(Path(id): Path<u64>) -> String {
    format!("User {id}")
}

// Multiple path params: /posts/42/comments/7
async fn get_comment(Path((post_id, comment_id)): Path<(u64, u64)>) -> String {
    format!("Post {post_id}, Comment {comment_id}")
}

// Query parameters: /search?q=rust&limit=10
#[derive(Deserialize)]
struct SearchParams {
    q: String,
    #[serde(default = "default_limit")]
    limit: u32,
}

fn default_limit() -> u32 { 10 }

async fn search(Query(params): Query<SearchParams>) -> String {
    format!("Searching for '{}' (limit: {})", params.q, params.limit)
}

// JSON body
#[derive(Deserialize)]
struct CreatePost {
    title: String,
    body: String,
}

async fn create_post(Json(post): Json<CreatePost>) -> String {
    format!("Created: {}", post.title)
}

// Headers
use axum::http::HeaderMap;

async fn check_auth(headers: HeaderMap) -> String {
    match headers.get("authorization") {
        Some(token) => format!("Token: {:?}", token),
        None => "No auth header".to_string(),
    }
}
```

---

## Shared State

```rust
use axum::{extract::State, routing::get, Json, Router};
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Clone)]
struct AppState {
    db: Arc<Mutex<Vec<String>>>,
}

async fn list_items(State(state): State<AppState>) -> Json<Vec<String>> {
    let items = state.db.lock().await;
    Json(items.clone())
}

async fn add_item(
    State(state): State<AppState>,
    body: String,
) -> String {
    let mut items = state.db.lock().await;
    items.push(body.clone());
    format!("Added: {body}")
}

#[tokio::main]
async fn main() {
    let state = AppState {
        db: Arc::new(Mutex::new(vec![])),
    };

    let app = Router::new()
        .route("/items", get(list_items).post(add_item))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
```

**Go equivalent:**
```go
type App struct {
    mu    sync.Mutex
    items []string
}
// pass *App through context or closure
```

---

## Error Handling

```rust
use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;

#[derive(Debug)]
enum AppError {
    NotFound(String),
    BadRequest(String),
    Internal(String),
}

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, msg),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg),
            AppError::Internal(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg),
        };

        (status, Json(ErrorResponse { error: message })).into_response()
    }
}

async fn get_user(Path(id): Path<u64>) -> Result<Json<User>, AppError> {
    if id == 0 {
        return Err(AppError::BadRequest("ID must be positive".to_string()));
    }
    if id > 1000 {
        return Err(AppError::NotFound(format!("User {id} not found")));
    }

    Ok(Json(User {
        id,
        name: "Augustus".to_string(),
        email: "aug@example.com".to_string(),
    }))
}

use axum::extract::Path;
use serde::Serialize;

#[derive(Serialize)]
struct User {
    id: u64,
    name: String,
    email: String,
}
```

---

## Middleware

```rust
use axum::{
    middleware::{self, Next},
    extract::Request,
    response::Response,
    Router,
    routing::get,
};
use std::time::Instant;

async fn logging_middleware(request: Request, next: Next) -> Response {
    let method = request.method().clone();
    let uri = request.uri().clone();
    let start = Instant::now();

    let response = next.run(request).await;

    let duration = start.elapsed();
    println!("{method} {uri} - {:?} - {}", duration, response.status());

    response
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/", get(|| async { "Hello!" }))
        .layer(middleware::from_fn(logging_middleware));

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
```

---

## Full App Structure

```
src/
├── main.rs           # entry point, router setup
├── config.rs         # configuration
├── error.rs          # AppError type
├── handlers/
│   ├── mod.rs
│   ├── users.rs      # user handlers
│   └── health.rs     # health check
├── models/
│   ├── mod.rs
│   └── user.rs       # User struct
└── middleware/
    ├── mod.rs
    └── auth.rs       # auth middleware
```

---

## Exercises

### Exercise 1: CRUD API
```
Build a TODO API with:
- GET    /todos       — list all todos
- POST   /todos       — create a todo
- GET    /todos/:id   — get one todo
- PUT    /todos/:id   — update a todo
- DELETE /todos/:id   — delete a todo

Use in-memory storage (Arc<Mutex<Vec<Todo>>>)
```

### Exercise 2: Add middleware
```
Add to your TODO API:
- Request logging middleware (method, path, duration)
- A simple API key auth middleware (check X-API-Key header)
```

---

## Key Takeaways

1. **Extractors define the API contract** — function signature = request shape.
2. **`Json<T>`** for request/response bodies. `Path<T>` for URL params.
3. **`State<T>`** for shared application state (like Go's app struct).
4. **`IntoResponse`** trait for custom error types.
5. **`Router::new().route().with_state()`** for building the app.
6. **Coming from Go:** Axum is closer to `chi` than `net/http`. Extractors
   replace `r.URL.Query()`, `json.Decode`, etc.

Next: [Lesson 20 — Putting It All Together](./20-project.md)
