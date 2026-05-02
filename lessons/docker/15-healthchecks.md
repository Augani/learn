# Health Checks and Restart Policies

## The Fire Alarm Test Analogy

Health checks are like a building's fire alarm system. You don't wait for a real fire to find out if the alarms work. Instead, you:

- **Periodically test** the alarms (interval)
- **Give each alarm a moment to respond** before marking it as broken (timeout)
- **Don't condemn a new alarm immediately** — it might just need time to warm up (start period)
- **Allow a few failures** before declaring an emergency (retries)
- **When an alarm fails repeatedly**, evacuate and bring in replacements (restart policies)

Without health checks, Docker only knows if a container's main process is running. A process can be running but completely broken — stuck in an infinite loop, deadlocked, or returning 500 errors on every request. Health checks detect the difference between "running" and "actually working."

---

## HEALTHCHECK in Dockerfile

The `HEALTHCHECK` instruction tells Docker how to test whether the container is working.

### Basic HTTP Health Check

```dockerfile
FROM node:20-alpine

WORKDIR /app
COPY . .
RUN npm ci --production

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
```

### Parameters Explained

| Parameter | Default | Meaning |
|-----------|---------|---------|
| `--interval` | 30s | Time between checks |
| `--timeout` | 30s | Max time to wait for a check to complete |
| `--start-period` | 0s | Grace period for container startup |
| `--retries` | 3 | Consecutive failures before "unhealthy" |

The timeline looks like:

```
Container starts
|-- start_period (10s) -- failures don't count --|
                                                  |-- interval (30s) --|
                                                                        check #1: pass -> healthy
                                                  |-- interval (30s) --|
                                                                        check #2: fail -> still healthy (1/3)
                                                  |-- interval (30s) --|
                                                                        check #3: fail -> still healthy (2/3)
                                                  |-- interval (30s) --|
                                                                        check #4: fail -> UNHEALTHY (3/3)
```

### Health Check Commands

**Using wget (available in Alpine):**

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1
```

**Using curl:**

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1
```

**Using a custom binary (for minimal images without curl/wget):**

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD ["/app/healthcheck"]
```

For Go applications, you can compile a tiny health check binary:

```go
package main

import (
	"net/http"
	"os"
	"time"
)

func main() {
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get("http://localhost:8080/health")
	if err != nil || resp.StatusCode != http.StatusOK {
		os.Exit(1)
	}
}
```

Build it alongside your main app:

```dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 go build -o /server ./cmd/server
RUN CGO_ENABLED=0 go build -o /healthcheck ./cmd/healthcheck

FROM scratch
COPY --from=builder /server /server
COPY --from=builder /healthcheck /healthcheck
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD ["/healthcheck"]
ENTRYPOINT ["/server"]
```

This avoids needing curl or wget in your production image.

**TCP health check (for databases and services without HTTP):**

```dockerfile
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD pg_isready -U myapp -d myapp || exit 1
```

**Command-based check (for workers, queues, etc.):**

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD redis-cli ping | grep -q PONG || exit 1
```

### Disable Health Checks

If a base image defines a health check and you want to remove it:

```dockerfile
FROM someimage:latest
HEALTHCHECK NONE
```

---

## Health Checks in Docker Compose

Compose health checks override any `HEALTHCHECK` in the Dockerfile.

### HTTP Health Check

```yaml
services:
  api:
    build: ./api
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:8080/health"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 15s
```

### Shell-Based Health Check

```yaml
services:
  postgres:
    image: postgres:16-alpine
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U myapp -d myapp"]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 10s
```

`CMD` executes the command directly (no shell). `CMD-SHELL` runs through `/bin/sh -c` (needed for pipes, variable expansion, etc.).

### Multiple Checks

Sometimes one check isn't enough. A database might accept connections but have a corrupted table:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U myapp && psql -U myapp -d myapp -c 'SELECT 1'"]
      interval: 10s
      timeout: 5s
      retries: 5
```

This checks both "can I connect?" AND "can I run a query?"

### Health Check for Common Services

**Redis:**

```yaml
services:
  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
```

**MongoDB:**

```yaml
services:
  mongo:
    image: mongo:7
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 20s
```

**Elasticsearch:**

```yaml
services:
  elasticsearch:
    image: elasticsearch:8.12.0
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:9200/_cluster/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 60s
```

**Nginx:**

```yaml
services:
  nginx:
    image: nginx:alpine
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:80 || exit 1"]
      interval: 10s
      timeout: 3s
      retries: 3
```

---

## Checking Health Status

```bash
docker ps
```

```
CONTAINER ID   IMAGE          STATUS                    PORTS
abc123         myapp-api      Up 5 minutes (healthy)    0.0.0.0:8080->8080/tcp
def456         postgres:16    Up 5 minutes (healthy)    5432/tcp
ghi789         redis:7        Up 5 minutes (healthy)    6379/tcp
```

The status shows `(healthy)`, `(unhealthy)`, or `(health: starting)`.

Detailed health information:

```bash
docker inspect --format='{{json .State.Health}}' myapp-api-1 | jq
```

```json
{
  "Status": "healthy",
  "FailingStreak": 0,
  "Log": [
    {
      "Start": "2024-01-15T10:30:00.000Z",
      "End": "2024-01-15T10:30:00.050Z",
      "ExitCode": 0,
      "Output": "{\"status\":\"ok\",\"db\":\"connected\",\"redis\":\"connected\"}\n"
    },
    {
      "Start": "2024-01-15T10:30:30.000Z",
      "End": "2024-01-15T10:30:30.048Z",
      "ExitCode": 0,
      "Output": "{\"status\":\"ok\",\"db\":\"connected\",\"redis\":\"connected\"}\n"
    }
  ]
}
```

Docker keeps the last 5 health check results.

---

## Restart Policies

When a container crashes or becomes unhealthy, restart policies determine what happens next.

### The Four Policies

```yaml
services:
  never-restart:
    restart: "no"

  always-restart:
    restart: always

  smart-restart:
    restart: unless-stopped

  crash-only:
    restart: on-failure
```

| Policy | Container stops | Docker daemon restarts | Manual `docker stop` |
|--------|----------------|----------------------|---------------------|
| `no` | Stays stopped | Stays stopped | Stays stopped |
| `always` | Restarts | Restarts | Restarts |
| `unless-stopped` | Restarts | Stays stopped if manually stopped | Stays stopped |
| `on-failure` | Restarts (non-zero exit only) | Restarts | Stays stopped |

### Which Policy to Use

```
Is this a one-off job (migration, backup)?
├── Yes -> restart: "no"
└── No -> Should it survive docker daemon restarts?
    ├── Yes, always -> restart: always
    ├── Yes, but respect manual stops -> restart: unless-stopped
    └── Only if it crashes -> restart: on-failure
```

For most production services: `unless-stopped`. For development: `no` or `on-failure`.

### Restart with Backoff

Docker uses exponential backoff for restarts. If a container crashes immediately, Docker waits before restarting:

```
Crash #1: restart immediately
Crash #2: wait 1 second
Crash #3: wait 2 seconds
Crash #4: wait 4 seconds
...up to a maximum of ~2 minutes between restarts
```

This prevents a broken container from consuming all CPU in a crash loop.

### on-failure with Max Retries

```bash
docker run -d --restart on-failure:5 myapp
```

Docker restarts the container up to 5 times on failure. After 5 consecutive failures, it gives up. In compose:

```yaml
services:
  worker:
    build: ./worker
    restart: on-failure
    deploy:
      restart_policy:
        condition: on-failure
        max_attempts: 5
        delay: 5s
        window: 120s
```

---

## How Docker Uses Health Status

### With depends_on

```yaml
services:
  api:
    depends_on:
      postgres:
        condition: service_healthy
```

Compose waits until PostgreSQL is healthy before starting the API. Without health checks, `depends_on` only waits for the container to start — not for the service to be ready.

### With Swarm Services

In Swarm mode, unhealthy containers are replaced:

```yaml
services:
  api:
    deploy:
      replicas: 3
      update_config:
        order: start-first
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:8080/health"]
      interval: 10s
      timeout: 5s
      retries: 3
```

If a replica becomes unhealthy, Swarm kills it and starts a replacement. During rolling updates, the new container must pass health checks before the old one is removed.

### With Load Balancers

Docker Swarm's internal load balancer removes unhealthy containers from the routing pool. External load balancers (like Traefik or Nginx) can also use Docker health status via the Docker API.

---

## Writing Good /health Endpoints

### Level 1: Liveness Check

"Is the process alive?"

```go
mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("ok"))
})
```

Fast, always succeeds if the process is running. Use this for Docker's HEALTHCHECK.

### Level 2: Readiness Check

"Can this service handle requests right now?"

```go
mux.HandleFunc("GET /ready", func(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]string{
			"status": "not ready",
			"error":  "database connection failed",
		})
		return
	}

	if err := redisClient.Ping(ctx).Err(); err != nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]string{
			"status": "not ready",
			"error":  "redis connection failed",
		})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ready"})
})
```

This checks dependencies. If the database is down, the service isn't ready to handle requests.

### Level 3: Detailed Health

"What is the status of every component?"

```go
type HealthResponse struct {
	Status     string                 `json:"status"`
	Version    string                 `json:"version"`
	Uptime     string                 `json:"uptime"`
	Components map[string]ComponentHealth `json:"components"`
}

type ComponentHealth struct {
	Status  string `json:"status"`
	Latency string `json:"latency,omitempty"`
	Error   string `json:"error,omitempty"`
}

func healthHandler(db *sql.DB, rdb *redis.Client, startTime time.Time) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()

		components := make(map[string]ComponentHealth)
		overallHealthy := true

		dbStart := time.Now()
		if err := db.PingContext(ctx); err != nil {
			components["database"] = ComponentHealth{
				Status: "unhealthy",
				Error:  err.Error(),
			}
			overallHealthy = false
		} else {
			components["database"] = ComponentHealth{
				Status:  "healthy",
				Latency: time.Since(dbStart).String(),
			}
		}

		redisStart := time.Now()
		if err := rdb.Ping(ctx).Err(); err != nil {
			components["redis"] = ComponentHealth{
				Status: "unhealthy",
				Error:  err.Error(),
			}
			overallHealthy = false
		} else {
			components["redis"] = ComponentHealth{
				Status:  "healthy",
				Latency: time.Since(redisStart).String(),
			}
		}

		resp := HealthResponse{
			Version:    "1.5.0",
			Uptime:     time.Since(startTime).String(),
			Components: components,
		}

		if overallHealthy {
			resp.Status = "healthy"
			w.WriteHeader(http.StatusOK)
		} else {
			resp.Status = "degraded"
			w.WriteHeader(http.StatusServiceUnavailable)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}
```

Response when healthy:

```json
{
  "status": "healthy",
  "version": "1.5.0",
  "uptime": "2h15m30s",
  "components": {
    "database": { "status": "healthy", "latency": "1.2ms" },
    "redis": { "status": "healthy", "latency": "0.3ms" }
  }
}
```

Response when degraded:

```json
{
  "status": "degraded",
  "version": "1.5.0",
  "uptime": "2h15m30s",
  "components": {
    "database": { "status": "unhealthy", "error": "connection refused" },
    "redis": { "status": "healthy", "latency": "0.3ms" }
  }
}
```

### TypeScript Health Endpoint

```typescript
import express from "express";
import { Pool } from "pg";
import { createClient } from "redis";

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const redis = createClient({ url: process.env.REDIS_URL });

interface ComponentHealth {
  status: "healthy" | "unhealthy";
  latency?: string;
  error?: string;
}

app.get("/health", async (_req, res) => {
  const components: Record<string, ComponentHealth> = {};
  let healthy = true;

  const dbStart = Date.now();
  try {
    await pool.query("SELECT 1");
    components.database = {
      status: "healthy",
      latency: `${Date.now() - dbStart}ms`,
    };
  } catch (err) {
    components.database = {
      status: "unhealthy",
      error: err instanceof Error ? err.message : "unknown error",
    };
    healthy = false;
  }

  const redisStart = Date.now();
  try {
    await redis.ping();
    components.redis = {
      status: "healthy",
      latency: `${Date.now() - redisStart}ms`,
    };
  } catch (err) {
    components.redis = {
      status: "unhealthy",
      error: err instanceof Error ? err.message : "unknown error",
    };
    healthy = false;
  }

  const statusCode = healthy ? 200 : 503;
  res.status(statusCode).json({
    status: healthy ? "healthy" : "degraded",
    components,
  });
});
```

### Health Check Best Practices

1. **Keep liveness checks simple** — they should be fast and cheap
2. **Don't check external dependencies in liveness** — if the database is down, the app is still "alive"
3. **Check dependencies in readiness** — the app is alive but can't serve requests
4. **Set timeouts shorter than intervals** — a check that takes longer than the interval causes overlapping checks
5. **Don't do expensive operations** — no full table scans, no complex queries
6. **Return structured JSON** — makes debugging easier
7. **Include version info** — helpful during deployments

---

## Graceful Shutdown

When Docker stops a container, it sends SIGTERM, waits (default 10 seconds), then sends SIGKILL. Your application should handle SIGTERM to shut down gracefully.

### Why It Matters

Without graceful shutdown:
- In-flight HTTP requests are dropped mid-response
- Database transactions are left incomplete
- Message queue items are lost
- TCP connections are reset (clients see errors)

With graceful shutdown:
- In-flight requests complete
- Database connections close cleanly
- Queue items are acknowledged or returned
- Clients get proper responses

### Go Graceful Shutdown

```go
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(2 * time.Second)
		w.Write([]byte("Hello, World!"))
	})

	srv := &http.Server{
		Addr:    ":8080",
		Handler: mux,
	}

	go func() {
		log.Println("server starting on :8080")
		if err := srv.ListenAndServe(); err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	sig := <-quit
	log.Printf("received signal %s, shutting down...", sig)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("forced shutdown: %v", err)
	}

	log.Println("server shut down gracefully")
}
```

`srv.Shutdown()` stops accepting new connections and waits for in-flight requests to complete, up to the context deadline.

### TypeScript Graceful Shutdown

```typescript
import http from "node:http";

const server = http.createServer((_req, res) => {
  setTimeout(() => {
    res.writeHead(200);
    res.end("Hello, World!");
  }, 2000);
});

server.listen(3000, () => {
  console.log("server starting on :3000");
});

const shutdown = (signal: string) => {
  console.log(`received ${signal}, shutting down...`);

  server.close(() => {
    console.log("server shut down gracefully");
    process.exit(0);
  });

  setTimeout(() => {
    console.log("forced shutdown after timeout");
    process.exit(1);
  }, 15_000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
```

### Docker Stop Timeout

```bash
docker stop --time 30 myapp
```

This gives the container 30 seconds (instead of the default 10) to handle SIGTERM before SIGKILL.

In Compose:

```yaml
services:
  api:
    build: ./api
    stop_grace_period: 30s
```

### The Shell Form Trap

```dockerfile
# WRONG: shell form — PID 1 is /bin/sh, not your app
CMD npm start

# RIGHT: exec form — PID 1 is node
CMD ["node", "server.js"]
```

With the shell form, Docker sends SIGTERM to `/bin/sh` (PID 1). The shell doesn't forward signals to your application. After 10 seconds, Docker sends SIGKILL, which kills everything abruptly.

With the exec form, your application IS PID 1 and receives SIGTERM directly.

If you must use shell form, use `exec`:

```dockerfile
CMD exec node server.js
```

Or use `tini` as an init process:

```dockerfile
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
```

Tini properly forwards signals and reaps zombie processes.

---

## Complete Example: Healthy Web Server

### Dockerfile

```dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /server ./cmd/server
RUN CGO_ENABLED=0 go build -o /healthcheck ./cmd/healthcheck

FROM scratch
COPY --from=builder /server /server
COPY --from=builder /healthcheck /healthcheck
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

USER 65534

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD ["/healthcheck"]

ENTRYPOINT ["/server"]
```

### docker-compose.yml

```yaml
services:
  api:
    build: .
    ports:
      - "8080:8080"
    environment:
      DB_HOST: postgres
      REDIS_HOST: redis
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "/healthcheck"]
      interval: 15s
      timeout: 3s
      retries: 3
      start_period: 10s
    restart: unless-stopped
    stop_grace_period: 30s

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: myapp
      POSTGRES_PASSWORD: devpassword
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U myapp -d myapp"]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 10s
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
    restart: unless-stopped

volumes:
  pgdata:
```

---

## Exercises

### Exercise 1: Add Health Checks

Take any existing Docker application and add:
1. A `/health` endpoint that checks database connectivity
2. A HEALTHCHECK instruction in the Dockerfile
3. Health checks in docker-compose.yml
4. `depends_on` with `condition: service_healthy`

Verify that `docker ps` shows `(healthy)` status.

### Exercise 2: Graceful Shutdown

Create a web server that:
1. Has a handler that sleeps for 5 seconds before responding
2. Handles SIGTERM gracefully
3. Test by starting a slow request, then stopping the container
4. Verify the request completes before the container stops

```bash
curl http://localhost:8080/slow &
docker compose stop api
```

The curl request should get a response, not a connection reset.

### Exercise 3: Restart Policy Testing

1. Create a container that randomly crashes (exit code 1) every few seconds
2. Test with each restart policy
3. Observe the backoff behavior with `docker events`

```bash
docker events --filter container=myapp &
docker run --name myapp --restart on-failure:3 alpine sh -c "sleep 2 && exit 1"
```

### Exercise 4: Health Check Timing

Experiment with different health check timing parameters:
1. Set interval=5s with a health check that takes 10s (timeout issue)
2. Set start_period=0 with a service that takes 15s to boot (false unhealthy)
3. Set retries=1 vs retries=5 and observe the difference in flap tolerance

---

## What Would Happen If...

**...your health check endpoint is too expensive?**

If `/health` runs a complex database query or heavy computation, it adds load proportional to `1/interval`. With a 5-second interval and a 200ms health check, that's 4% of your capacity spent on health checks. Keep them cheap (< 10ms).

**...you set the timeout longer than the interval?**

Health checks can overlap. If a check takes 31 seconds with a 30-second interval, the next check starts before the first finishes. This wastes resources and gives confusing results. Always: `timeout < interval`.

**...your process runs as PID 1 without signal handling?**

Docker sends SIGTERM, your process ignores it (many programs do by default when PID 1), Docker waits 10 seconds, then sends SIGKILL. Every stop takes exactly 10 seconds. Use tini or handle signals explicitly.

**...you use `restart: always` with a broken container?**

The container enters a crash loop. Docker restarts it with exponential backoff, consuming resources each time. With `on-failure:5`, Docker gives up after 5 attempts. With `always`, it never gives up.

**...a health check passes but the application is serving wrong data?**

Health checks verify infrastructure, not business logic. If your API returns `200 OK` with garbage data, the health check still passes. Health checks are necessary but not sufficient. You still need monitoring, error tracking, and integration tests.

---

## Key Takeaways

1. Health checks detect the difference between "running" and "working"
2. Use `start_period` to give services time to initialize
3. Keep health checks cheap and fast — they run frequently
4. `depends_on` + `condition: service_healthy` prevents startup race conditions
5. Use `restart: unless-stopped` for production services
6. Handle SIGTERM in your application for graceful shutdown
7. Use exec form (`CMD ["node", "server.js"]`) so your app receives signals
8. Separate liveness (is it alive?) from readiness (can it serve traffic?)
