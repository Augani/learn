# Docker Compose Deep Dive

## What Compose Really Is

Docker Compose is a declarative way to describe a multi-container application. Instead of running ten `docker run` commands with flags you'll forget, you write a YAML file that captures the entire topology: services, networks, volumes, and their relationships.

Think of it like `package.json` for your infrastructure. Just as `npm install` sets up your Node dependencies from a declaration, `docker compose up` sets up your entire application stack from a declaration.

---

## Anatomy of a Compose File

```yaml
name: myproject

services:
  api:
    build: ./api
    ports:
      - "8080:8080"
    environment:
      DB_HOST: postgres
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - backend

  postgres:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U myapp"]
      interval: 5s
      timeout: 3s
      retries: 5
    networks:
      - backend

networks:
  backend:
    driver: bridge

volumes:
  pgdata:
```

Three top-level keys: `services`, `networks`, `volumes`. Everything else hangs off these.

---

## Services

A service is a container definition. Compose can run one or more instances of each service.

### Build vs Image

Pull a pre-built image:

```yaml
services:
  redis:
    image: redis:7-alpine
```

Build from a Dockerfile:

```yaml
services:
  api:
    build:
      context: ./api
      dockerfile: Dockerfile
      args:
        GO_VERSION: "1.22"
      target: production
```

Use both (build locally, tag for pushing):

```yaml
services:
  api:
    build: ./api
    image: myregistry.com/myapp-api:latest
```

`docker compose build` builds it. `docker compose push` pushes the tagged image.

### Port Mapping

```yaml
services:
  api:
    ports:
      - "8080:8080"
      - "127.0.0.1:9090:9090"
      - "3000-3005:3000-3005"
      - "8443:443/tcp"
```

Always quote port mappings. YAML interprets `80:80` as a base-60 number without quotes.

### Resource Limits

```yaml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: "2.0"
          memory: 512M
        reservations:
          cpus: "0.5"
          memory: 128M
```

Limits are hard caps — the container is killed if it exceeds memory. Reservations are guaranteed minimums.

This works in `docker compose up` since Compose v2. Previously it was Swarm-only.

### Restart Policies

```yaml
services:
  api:
    restart: unless-stopped

  worker:
    restart: on-failure

  one-off-task:
    restart: "no"
```

| Policy | Behavior |
|--------|----------|
| `no` | Never restart (default) |
| `always` | Always restart, even after `docker stop` + daemon restart |
| `unless-stopped` | Restart unless you explicitly stopped it |
| `on-failure` | Restart only on non-zero exit code |

For production services, use `unless-stopped`. For batch jobs, use `on-failure` or `no`.

---

## depends_on and Startup Order

### The Problem

Your Go API connects to PostgreSQL on startup. You write:

```yaml
services:
  api:
    build: ./api
    depends_on:
      - postgres

  postgres:
    image: postgres:16-alpine
```

Compose starts PostgreSQL first, THEN the API. But "started" doesn't mean "ready." PostgreSQL takes seconds to initialize. Your API crashes because it can't connect.

This is like sending a letter to a new office before the phone lines are installed. The office exists, but it can't receive calls yet.

### The Solution: Healthcheck-Based Ordering

```yaml
services:
  api:
    build: ./api
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: myapp
      POSTGRES_PASSWORD: devpassword
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U myapp -d myapp"]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 10s

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
```

Now Compose waits until PostgreSQL and Redis are HEALTHY before starting the API.

`start_period` gives the service time to initialize before health checks count as failures. PostgreSQL might take 8 seconds to set up — the `start_period: 10s` means failures during that window don't count toward `retries`.

### depends_on Conditions

```yaml
depends_on:
  postgres:
    condition: service_started      # container is running (default)
  postgres:
    condition: service_healthy      # healthcheck passes
  postgres:
    condition: service_completed_successfully  # exited with code 0
```

`service_completed_successfully` is useful for init containers:

```yaml
services:
  migrate:
    build: ./api
    command: ["./migrate", "up"]
    depends_on:
      postgres:
        condition: service_healthy

  api:
    build: ./api
    depends_on:
      migrate:
        condition: service_completed_successfully
```

The migration runs first, completes, and THEN the API starts. This pattern is straight from Kubernetes init containers.

---

## Profiles

Profiles let you define optional services that only start when explicitly activated. Think of them like feature flags for your infrastructure.

```yaml
services:
  api:
    build: ./api
    ports:
      - "8080:8080"

  postgres:
    image: postgres:16-alpine

  redis:
    image: redis:7-alpine

  mailhog:
    image: mailhog/mailhog
    ports:
      - "8025:8025"
    profiles:
      - debug

  pgadmin:
    image: dpage/pgadmin4
    ports:
      - "5050:80"
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@admin.com
      PGADMIN_DEFAULT_PASSWORD: admin
    profiles:
      - debug

  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
    ports:
      - "9090:9090"
    profiles:
      - monitoring

  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
    profiles:
      - monitoring
```

```bash
docker compose up -d

docker compose --profile debug up -d

docker compose --profile debug --profile monitoring up -d
```

Without `--profile`, only services WITHOUT profiles start. This keeps your default `docker compose up` fast and lightweight.

Set profiles via environment variable:

```bash
COMPOSE_PROFILES=debug,monitoring docker compose up -d
```

---

## Extends and Anchors (DRY Config)

### YAML Anchors

YAML anchors let you define a block once and reuse it. This is native YAML, not a Docker feature.

```yaml
x-common-env: &common-env
  LOG_LEVEL: info
  TZ: UTC
  NODE_ENV: production

x-healthcheck-defaults: &healthcheck-defaults
  interval: 10s
  timeout: 5s
  retries: 3
  start_period: 30s

services:
  api:
    build: ./api
    environment:
      <<: *common-env
      DB_HOST: postgres
      PORT: "8080"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      <<: *healthcheck-defaults

  worker:
    build: ./worker
    environment:
      <<: *common-env
      DB_HOST: postgres
      QUEUE: default
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8081/health"]
      <<: *healthcheck-defaults
```

The `x-` prefix tells Compose to ignore these keys as top-level elements. The `&` creates an anchor, `*` references it, and `<<:` merges it into the current mapping.

### Extends

`extends` lets one service inherit from another:

```yaml
services:
  base-api:
    build: ./api
    environment:
      LOG_LEVEL: info
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 10s
      timeout: 5s
      retries: 3

  api:
    extends:
      service: base-api
    ports:
      - "8080:8080"
    environment:
      PORT: "8080"

  admin-api:
    extends:
      service: base-api
    ports:
      - "8081:8080"
    environment:
      PORT: "8080"
      ADMIN_MODE: "true"
```

Extend from a separate file:

```yaml
services:
  api:
    extends:
      file: common-services.yml
      service: go-api
    ports:
      - "8080:8080"
```

---

## Override Files

Docker Compose automatically loads `docker-compose.override.yml` if it exists. This is how you separate dev and production configs.

**docker-compose.yml** (base — shared by all environments):

```yaml
services:
  api:
    build: ./api
    environment:
      DB_HOST: postgres
    depends_on:
      postgres:
        condition: service_healthy

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: myapp
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U myapp"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  pgdata:
```

**docker-compose.override.yml** (dev — loaded automatically):

```yaml
services:
  api:
    volumes:
      - ./api/src:/app/src
    ports:
      - "8080:8080"
    environment:
      LOG_LEVEL: debug
      POSTGRES_PASSWORD: devpassword

  postgres:
    ports:
      - "127.0.0.1:5432:5432"
    environment:
      POSTGRES_PASSWORD: devpassword
```

**docker-compose.prod.yml** (production — loaded explicitly):

```yaml
services:
  api:
    image: myregistry.com/myapp-api:${VERSION}
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: "2.0"
          memory: 1G
    environment:
      LOG_LEVEL: warn

  postgres:
    restart: unless-stopped
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    deploy:
      resources:
        limits:
          memory: 2G
```

Use them:

```bash
docker compose up -d

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

The override values are MERGED. Lists (ports, volumes) are appended. Scalars (image, restart) are replaced.

---

## Environment Files

### .env File

Compose automatically reads `.env` in the project directory for variable substitution:

```
# .env
POSTGRES_PASSWORD=devpassword
API_VERSION=1.5.0
COMPOSE_PROJECT_NAME=myapp
```

```yaml
services:
  api:
    image: myregistry.com/api:${API_VERSION}

  postgres:
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
```

### Per-Service env_file

Load environment variables from a file into a specific service:

```yaml
services:
  api:
    build: ./api
    env_file:
      - .env
      - .env.api

  worker:
    build: ./worker
    env_file:
      - .env
      - .env.worker
```

```
# .env.api
PORT=8080
API_KEY=dev-key-12345

# .env.worker
QUEUE_NAME=default
WORKER_CONCURRENCY=4
```

### Variable Substitution

```yaml
services:
  api:
    image: myregistry.com/api:${VERSION:-latest}
    environment:
      DB_HOST: ${DB_HOST:?DB_HOST is required}
      LOG_LEVEL: ${LOG_LEVEL:-info}
```

| Syntax | Meaning |
|--------|---------|
| `${VAR}` | Value of VAR, empty string if unset |
| `${VAR:-default}` | Value of VAR, or "default" if unset |
| `${VAR:?error msg}` | Value of VAR, or ERROR if unset |
| `${VAR:+replacement}` | "replacement" if VAR is set, empty if unset |

---

## Building a Real Dev Environment

Here's a complete development stack: Go API, PostgreSQL, Redis, and Nginx reverse proxy.

### Project Structure

```
myproject/
├── docker-compose.yml
├── docker-compose.override.yml
├── .env
├── api/
│   ├── Dockerfile
│   ├── go.mod
│   ├── go.sum
│   └── main.go
├── nginx/
│   └── nginx.conf
└── db/
    └── init.sql
```

### docker-compose.yml

```yaml
name: myproject

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      api:
        condition: service_healthy
    networks:
      - frontend

  api:
    build:
      context: ./api
      target: development
    environment:
      DB_HOST: postgres
      DB_PORT: "5432"
      DB_USER: myapp
      DB_NAME: myapp
      DB_PASSWORD: ${POSTGRES_PASSWORD}
      REDIS_HOST: redis
      REDIS_PORT: "6379"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:8080/health"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 15s
    networks:
      - frontend
      - backend

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: myapp
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./db/init.sql:/docker-entrypoint-initdb.d/01-init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U myapp -d myapp"]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 10s
    networks:
      - backend

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
    networks:
      - backend

networks:
  frontend:
  backend:
    internal: true

volumes:
  pgdata:
  redis-data:
```

### docker-compose.override.yml

```yaml
services:
  api:
    volumes:
      - ./api:/app
      - go-modules:/go/pkg/mod
    ports:
      - "8080:8080"

  postgres:
    ports:
      - "127.0.0.1:5432:5432"

  redis:
    ports:
      - "127.0.0.1:6379:6379"

volumes:
  go-modules:
```

### .env

```
POSTGRES_PASSWORD=devpassword
```

### api/Dockerfile

```dockerfile
FROM golang:1.22-alpine AS development
WORKDIR /app
RUN apk add --no-cache git
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go install github.com/air-verse/air@latest
CMD ["air", "-c", ".air.toml"]

FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /server .

FROM gcr.io/distroless/static-debian12 AS production
COPY --from=builder /server /server
USER nonroot
ENTRYPOINT ["/server"]
```

### api/main.go

```go
package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	_ "github.com/lib/pq"
	"github.com/redis/go-redis/v9"
)

func main() {
	dbHost := envOrDefault("DB_HOST", "localhost")
	dbPort := envOrDefault("DB_PORT", "5432")
	dbUser := envOrDefault("DB_USER", "myapp")
	dbName := envOrDefault("DB_NAME", "myapp")
	dbPassword := envOrDefault("DB_PASSWORD", "devpassword")
	redisHost := envOrDefault("REDIS_HOST", "localhost")
	redisPort := envOrDefault("REDIS_PORT", "6379")

	connStr := fmt.Sprintf(
		"host=%s port=%s user=%s dbname=%s password=%s sslmode=disable",
		dbHost, dbPort, dbUser, dbName, dbPassword,
	)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		log.Fatalf("failed to open database: %v", err)
	}
	defer db.Close()

	rdb := redis.NewClient(&redis.Options{
		Addr: fmt.Sprintf("%s:%s", redisHost, redisPort),
	})
	defer rdb.Close()

	mux := http.NewServeMux()

	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()

		if err := db.PingContext(ctx); err != nil {
			http.Error(w, "database unhealthy", http.StatusServiceUnavailable)
			return
		}
		if err := rdb.Ping(ctx).Err(); err != nil {
			http.Error(w, "redis unhealthy", http.StatusServiceUnavailable)
			return
		}

		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	mux.HandleFunc("GET /api/users", func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.QueryContext(r.Context(), "SELECT id, email FROM users")
		if err != nil {
			http.Error(w, "query failed", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type User struct {
			ID    int    `json:"id"`
			Email string `json:"email"`
		}

		var users []User
		for rows.Next() {
			var u User
			if err := rows.Scan(&u.ID, &u.Email); err != nil {
				http.Error(w, "scan failed", http.StatusInternalServerError)
				return
			}
			users = append(users, u)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(users)
	})

	srv := &http.Server{
		Addr:         ":8080",
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("server listening on :8080")
		if err := srv.ListenAndServe(); err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
	log.Println("server shut down gracefully")
}

func envOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
```

### nginx/nginx.conf

```nginx
upstream api {
    server api:8080;
}

server {
    listen 80;

    location /api/ {
        proxy_pass http://api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /health {
        proxy_pass http://api;
    }

    location / {
        return 200 '{"message": "nginx is running"}';
        add_header Content-Type application/json;
    }
}
```

### db/init.sql

```sql
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO users (email) VALUES
    ('alice@example.com'),
    ('bob@example.com'),
    ('charlie@example.com');
```

---

## Essential Commands

### Lifecycle

```bash
docker compose up -d

docker compose up -d --build

docker compose down

docker compose down -v

docker compose restart api

docker compose stop
docker compose start
```

### Logs

```bash
docker compose logs

docker compose logs api

docker compose logs -f api postgres

docker compose logs --since 5m api

docker compose logs --tail 100 api
```

### Exec (Run Commands in Running Containers)

```bash
docker compose exec postgres psql -U myapp -d myapp

docker compose exec api sh

docker compose exec redis redis-cli INFO memory
```

### Run (One-Off Commands in New Containers)

```bash
docker compose run --rm api go test ./...

docker compose run --rm api ./migrate up

docker compose run --rm -e DEBUG=true api sh
```

`exec` attaches to a running container. `run` creates a new container from the service definition.

### Build

```bash
docker compose build

docker compose build api

docker compose build --no-cache api

docker compose build --parallel
```

### Scale

```bash
docker compose up -d --scale api=3
```

This creates three instances of the `api` service. Other services can reach them via DNS round-robin at the hostname `api`.

Remove the port mapping from the scaled service (or use random ports) to avoid conflicts:

```yaml
services:
  api:
    build: ./api
```

Put nginx in front to load balance:

```nginx
upstream api {
    server api:8080;
}
```

Nginx resolves `api` to all three container IPs and distributes requests.

### Configuration Validation

```bash
docker compose config

docker compose config --services

docker compose config --volumes
```

`docker compose config` renders the final merged configuration after variable substitution and override merging. Invaluable for debugging "why isn't my env var set."

---

## Exercises

### Exercise 1: Build the Full Stack

Create the complete project described above. Run `docker compose up -d`. Verify:
- `curl http://localhost/health` returns `{"status": "ok"}`
- `curl http://localhost/api/users` returns the seeded users
- PostgreSQL is accessible on `127.0.0.1:5432` from your host
- Redis is accessible on `127.0.0.1:6379` from your host

### Exercise 2: Profiles

Add these optional services to the compose file:
- `pgadmin` (profile: debug) — a web UI for PostgreSQL
- `redis-commander` (profile: debug) — a web UI for Redis
- `prometheus` + `grafana` (profile: monitoring)

Start only the core services, then selectively enable profiles.

### Exercise 3: Override Files

Create three configurations:
- Base (`docker-compose.yml`) — service definitions, no ports exposed
- Development (`docker-compose.override.yml`) — ports exposed, bind mounts, debug logging
- Production (`docker-compose.prod.yml`) — pre-built images, resource limits, restart policies

Run each and verify the differences with `docker compose config`.

### Exercise 4: Startup Ordering

Modify the API to intentionally crash if PostgreSQL isn't ready. Then configure `depends_on` with health checks to prevent this. Remove the healthcheck and observe the failure.

### Exercise 5: Scaling

Scale the API service to 3 instances behind nginx. Use `docker compose logs -f api` to watch which instance handles each request. Add the container hostname to API responses to verify load balancing.

---

## What Would Happen If...

**...you forgot to add `condition: service_healthy` to depends_on?**

Compose starts the dependent container as soon as the dependency container is "running" — not "ready." Your API tries to connect to PostgreSQL before it's accepting connections and crashes. With `restart: unless-stopped`, it'll keep crashing and restarting until PostgreSQL is ready, which wastes resources and floods your logs.

**...you ran `docker compose up` without the override file?**

Your API has no bind mounts (no hot reload) and no exposed ports. You'd need to go through nginx for everything. This is actually what production should look like.

**...two compose projects used the same volume name?**

They share the volume. Two different PostgreSQL instances writing to the same data directory. Corruption guaranteed. Use the `name` key or let Compose prefix with the project name (default behavior).

**...you put database passwords directly in the compose file and committed it to git?**

Everyone with repo access has your credentials. Use `.env` files (add `.env` to `.gitignore`) or Docker secrets. Even in `.env`, store a `.env.example` with placeholder values so new developers know what variables are needed.

**...you used `docker compose down` when you meant `docker compose stop`?**

`down` removes containers AND networks. `stop` just stops containers without removing them. For a quick pause during development, use `stop`. For a clean slate, use `down`. For nuclear option, use `down -v` (removes volumes too).

---

## Key Takeaways

1. Compose is declarative infrastructure — treat `docker-compose.yml` like code
2. Use healthcheck-based `depends_on` for reliable startup ordering
3. Profiles keep optional services out of your default workflow
4. Override files separate dev and production concerns cleanly
5. YAML anchors and `extends` keep configurations DRY
6. `.env` files should never be committed — use `.env.example`
7. `docker compose config` is your debugging superpower for merged configs
8. Scale services with `--scale` and put a reverse proxy in front
