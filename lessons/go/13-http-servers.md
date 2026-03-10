# Lesson 13: HTTP Servers

## Building REST APIs

Go was built for servers. The `net/http` package gives you a
production-ready HTTP server with zero dependencies. It's like
having a full restaurant kitchen — no extra equipment needed.

```
HTTP Request Flow:

Client --> net/http Server --> Router --> Handler --> Response
                                |
                          Middleware Chain
                          (logging, auth, cors)
```

---

## The Simplest Server

```go
package main

import (
    "fmt"
    "net/http"
)

func main() {
    http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
        fmt.Fprintf(w, "Hello, %s!", r.URL.Path[1:])
    })

    http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(http.StatusOK)
        w.Write([]byte(`{"status":"ok"}`))
    })

    fmt.Println("Server starting on :8080")
    http.ListenAndServe(":8080", nil)
}
```

`http.ResponseWriter` is an `io.Writer`. Write anything to it —
strings, JSON, HTML, binary data.

---

## Using ServeMux (Go 1.22+)

Go 1.22 added method and path parameter matching to `ServeMux`:

```go
package main

import (
    "encoding/json"
    "fmt"
    "net/http"
    "sync"
)

type User struct {
    ID    string `json:"id"`
    Name  string `json:"name"`
    Email string `json:"email"`
}

type UserStore struct {
    mu    sync.RWMutex
    users map[string]User
}

func NewUserStore() *UserStore {
    return &UserStore{users: make(map[string]User)}
}

func (s *UserStore) HandleList(w http.ResponseWriter, r *http.Request) {
    s.mu.RLock()
    defer s.mu.RUnlock()

    users := make([]User, 0, len(s.users))
    for _, u := range s.users {
        users = append(users, u)
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(users)
}

func (s *UserStore) HandleGet(w http.ResponseWriter, r *http.Request) {
    id := r.PathValue("id")

    s.mu.RLock()
    user, ok := s.users[id]
    s.mu.RUnlock()

    if !ok {
        http.Error(w, "user not found", http.StatusNotFound)
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(user)
}

func (s *UserStore) HandleCreate(w http.ResponseWriter, r *http.Request) {
    var user User
    if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
        http.Error(w, "invalid JSON", http.StatusBadRequest)
        return
    }

    if user.ID == "" || user.Name == "" {
        http.Error(w, "id and name required", http.StatusBadRequest)
        return
    }

    s.mu.Lock()
    s.users[user.ID] = user
    s.mu.Unlock()

    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(http.StatusCreated)
    json.NewEncoder(w).Encode(user)
}

func main() {
    store := NewUserStore()
    mux := http.NewServeMux()

    mux.HandleFunc("GET /users", store.HandleList)
    mux.HandleFunc("GET /users/{id}", store.HandleGet)
    mux.HandleFunc("POST /users", store.HandleCreate)
    mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
        w.Write([]byte(`{"status":"ok"}`))
    })

    fmt.Println("Server on :8080")
    http.ListenAndServe(":8080", mux)
}
```

`r.PathValue("id")` extracts path parameters. Method routing
(`GET /users`) is built in since Go 1.22.

---

## Middleware

Middleware wraps handlers to add cross-cutting concerns.
Think of it as security checkpoints before entering a building.

```
Request --> [Logging] --> [Auth] --> [CORS] --> Handler
                                                  |
Response <-- [Logging] <-- [Auth] <-- [CORS] <----+
```

```go
package main

import (
    "fmt"
    "log"
    "net/http"
    "time"
)

func loggingMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        start := time.Now()
        next.ServeHTTP(w, r)
        log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start))
    })
}

func corsMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Access-Control-Allow-Origin", "*")
        w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE")
        w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

        if r.Method == http.MethodOptions {
            w.WriteHeader(http.StatusOK)
            return
        }

        next.ServeHTTP(w, r)
    })
}

func recoveryMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        defer func() {
            if err := recover(); err != nil {
                log.Printf("panic recovered: %v", err)
                http.Error(w, "internal server error", http.StatusInternalServerError)
            }
        }()
        next.ServeHTTP(w, r)
    })
}

func main() {
    mux := http.NewServeMux()
    mux.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
        fmt.Fprintln(w, "Hello!")
    })

    handler := loggingMiddleware(corsMiddleware(recoveryMiddleware(mux)))

    fmt.Println("Server on :8080")
    http.ListenAndServe(":8080", handler)
}
```

Middleware is just a function that takes an `http.Handler` and
returns an `http.Handler`. They compose naturally.

---

## JSON Helpers

```go
package main

import (
    "encoding/json"
    "net/http"
)

func writeJSON(w http.ResponseWriter, status int, data any) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(status)
    json.NewEncoder(w).Encode(data)
}

func readJSON(r *http.Request, dst any) error {
    decoder := json.NewDecoder(r.Body)
    decoder.DisallowUnknownFields()
    return decoder.Decode(dst)
}

type ErrorResponse struct {
    Error string `json:"error"`
}

func writeError(w http.ResponseWriter, status int, msg string) {
    writeJSON(w, status, ErrorResponse{Error: msg})
}

func main() {
    mux := http.NewServeMux()
    mux.HandleFunc("GET /api/ping", func(w http.ResponseWriter, r *http.Request) {
        writeJSON(w, http.StatusOK, map[string]string{"message": "pong"})
    })
    http.ListenAndServe(":8080", mux)
}
```

---

## Using Chi Router

Chi is a lightweight, idiomatic router that adds features the
stdlib doesn't have:

```go
package main

import (
    "encoding/json"
    "fmt"
    "net/http"

    "github.com/go-chi/chi/v5"
    "github.com/go-chi/chi/v5/middleware"
)

func main() {
    r := chi.NewRouter()

    r.Use(middleware.Logger)
    r.Use(middleware.Recoverer)
    r.Use(middleware.RequestID)

    r.Get("/", func(w http.ResponseWriter, r *http.Request) {
        w.Write([]byte("hello"))
    })

    r.Route("/api/v1", func(r chi.Router) {
        r.Get("/users", listUsers)
        r.Post("/users", createUser)
        r.Get("/users/{id}", getUser)
        r.Put("/users/{id}", updateUser)
        r.Delete("/users/{id}", deleteUser)
    })

    fmt.Println("Server on :8080")
    http.ListenAndServe(":8080", r)
}

func listUsers(w http.ResponseWriter, r *http.Request)  {}
func createUser(w http.ResponseWriter, r *http.Request) {}
func getUser(w http.ResponseWriter, r *http.Request) {
    id := chi.URLParam(r, "id")
    json.NewEncoder(w).Encode(map[string]string{"id": id})
}
func updateUser(w http.ResponseWriter, r *http.Request) {}
func deleteUser(w http.ResponseWriter, r *http.Request) {}
```

Chi is fully compatible with `net/http` — handlers are the same
`http.HandlerFunc` signature.

---

## Graceful Shutdown

```go
package main

import (
    "context"
    "fmt"
    "net/http"
    "os"
    "os/signal"
    "syscall"
    "time"
)

func main() {
    mux := http.NewServeMux()
    mux.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
        w.Write([]byte("hello"))
    })

    server := &http.Server{
        Addr:         ":8080",
        Handler:      mux,
        ReadTimeout:  5 * time.Second,
        WriteTimeout: 10 * time.Second,
        IdleTimeout:  120 * time.Second,
    }

    go func() {
        fmt.Println("Server starting on :8080")
        if err := server.ListenAndServe(); err != http.ErrServerClosed {
            fmt.Printf("Server error: %v\n", err)
        }
    }()

    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
    <-quit

    fmt.Println("Shutting down...")
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()

    if err := server.Shutdown(ctx); err != nil {
        fmt.Printf("Shutdown error: %v\n", err)
    }
    fmt.Println("Server stopped")
}
```

Always configure timeouts. Always handle graceful shutdown.

---

## Server Architecture

```
+--------------------------------------------------+
|                    main.go                        |
|  server := NewServer(config)                      |
|  server.ListenAndServe()                          |
+---------------------------+----------------------+
                            |
              +-------------+-------------+
              |                           |
     +--------+--------+        +--------+--------+
     |   routes.go     |        | middleware.go    |
     | SetupRoutes()   |        | Logging()        |
     | /api/v1/users   |        | Auth()           |
     | /api/v1/orders  |        | CORS()           |
     +--------+--------+        +-----------------+
              |
     +--------+--------+
     | handlers/        |
     |   users.go       |
     |   orders.go      |
     +--------+--------+
              |
     +--------+--------+
     | services/        |
     |   user_svc.go    |
     |   order_svc.go   |
     +--------+--------+
              |
     +--------+--------+
     | store/           |
     |   user_store.go  |
     |   order_store.go |
     +-----------------+
```

---

## Exercises

1. Build a REST API with CRUD operations for a "todo" resource
   using `net/http` and Go 1.22+ routing

2. Add logging and recovery middleware to your server

3. Implement graceful shutdown with a 30-second timeout

4. Write `writeJSON` and `readJSON` helpers and use them
   consistently across handlers

5. Add request validation: reject requests with missing required
   fields and return proper error responses

---

[Next: Lesson 14 - CLI Tools ->](14-cli-tools.md)
