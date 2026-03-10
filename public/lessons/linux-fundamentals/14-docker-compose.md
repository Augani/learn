# Lesson 14: Docker Compose and Multi-Container Setups

Real applications are not a single process. A typical web application needs an API server, a database, maybe a cache (Redis), a background job worker, and a reverse proxy. Docker Compose lets you define and manage all of these as a single unit.

---

## The Problem

Without Compose, starting a development environment looks like this:

```bash
docker network create myapp

docker run -d --name postgres --network myapp \
  -e POSTGRES_PASSWORD=secret \
  -e POSTGRES_DB=myapp \
  -v pgdata:/var/lib/postgresql/data \
  -p 5432:5432 postgres:16

docker run -d --name redis --network myapp \
  -p 6379:6379 redis:7-alpine

docker run -d --name api --network myapp \
  -e DATABASE_URL=postgres://postgres:secret@postgres:5432/myapp \
  -e REDIS_URL=redis://redis:6379 \
  -p 8080:8080 myapp
```

Three separate commands, easy to get wrong, hard to reproduce. And you have to reverse it all to tear down:

```bash
docker stop api redis postgres
docker rm api redis postgres
docker network rm myapp
```

Docker Compose replaces all of this with a single file and two commands: `docker compose up` and `docker compose down`.

---

## docker-compose.yml

The Compose file defines your entire multi-container environment:

```yaml
services:
  api:
    build: .
    ports:
      - "8080:8080"
    environment:
      DATABASE_URL: postgres://postgres:secret@db:5432/myapp
      REDIS_URL: redis://cache:6379
      RUST_LOG: info
    depends_on:
      db:
        condition: service_healthy
      cache:
        condition: service_started
    volumes:
      - ./src:/app/src

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: myapp
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  cache:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  pgdata:
```

---

## Core Concepts

### Services

Each entry under `services` defines a container. The service name (`api`, `db`, `cache`) becomes the hostname on the Docker network, so `api` can reach `db` at `postgres://db:5432`.

### Image vs Build

```yaml
services:
  # Use a pre-built image from Docker Hub
  db:
    image: postgres:16-alpine

  # Build from a Dockerfile in the current directory
  api:
    build: .

  # Build with options
  api:
    build:
      context: .
      dockerfile: Dockerfile.dev
      args:
        RUST_VERSION: "1.75"
```

### Ports

```yaml
ports:
  - "8080:3000"        # host:container
  - "5432:5432"        # same port on both
  - "127.0.0.1:8080:3000"  # only bind to localhost
```

### Environment Variables

```yaml
services:
  api:
    environment:
      DATABASE_URL: postgres://postgres:secret@db:5432/myapp
      RUST_LOG: debug

    # Or load from a file
    env_file:
      - .env
      - .env.local
```

### Volumes

```yaml
services:
  api:
    volumes:
      - ./src:/app/src              # bind mount: host path → container path
      - ./config:/app/config:ro     # read-only bind mount

  db:
    volumes:
      - pgdata:/var/lib/postgresql/data   # named volume

volumes:
  pgdata:                           # declare named volumes
```

Bind mounts are for development (edit code locally, see changes in container). Named volumes are for persistent data (database files).

---

## depends_on and Health Checks

### depends_on: Start order

```yaml
services:
  api:
    depends_on:
      - db
      - cache
```

This ensures `db` and `cache` start before `api`. But "started" does not mean "ready" — PostgreSQL might still be initializing when `api` tries to connect.

### Health checks: Wait until ready

```yaml
services:
  db:
    image: postgres:16-alpine
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 10s

  api:
    depends_on:
      db:
        condition: service_healthy    # wait until db is HEALTHY, not just started
```

Now `api` waits until PostgreSQL is actually accepting connections.

Common health checks:

```yaml
# PostgreSQL
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U postgres"]
  interval: 5s
  timeout: 5s
  retries: 5

# Redis
healthcheck:
  test: ["CMD", "redis-cli", "ping"]
  interval: 5s
  timeout: 3s
  retries: 5

# HTTP service
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
  interval: 10s
  timeout: 5s
  retries: 3
```

---

## Networks

Compose creates a default network for your project. All services can reach each other by service name.

```yaml
services:
  api:
    networks:
      - frontend
      - backend

  db:
    networks:
      - backend          # db is NOT on frontend, so it's not directly reachable from outside

  nginx:
    networks:
      - frontend

networks:
  frontend:
  backend:
```

---

## Commands

```bash
docker compose up                # start all services (foreground, logs to terminal)
docker compose up -d             # start all services (detached/background)
docker compose up --build        # rebuild images before starting
docker compose up -d api         # start only the api service (and its dependencies)

docker compose down              # stop and remove containers, networks
docker compose down -v           # also remove volumes (database data!)

docker compose ps                # show running services
docker compose logs              # all logs
docker compose logs -f api       # follow api logs
docker compose logs --tail 50    # last 50 lines from each service

docker compose exec api bash     # shell into running api container
docker compose exec db psql -U postgres  # connect to postgres

docker compose build             # rebuild all images
docker compose build api         # rebuild just the api image

docker compose restart api       # restart a service
docker compose stop              # stop without removing
docker compose start             # start stopped services

docker compose config            # validate and display the resolved config
```

---

## Practical Setup: Rust API + PostgreSQL + Redis

### Project structure

```
myapp/
  src/
    main.rs
  migrations/
  Cargo.toml
  Cargo.lock
  Dockerfile
  docker-compose.yml
  .env
```

### Dockerfile (multi-stage for Rust)

```dockerfile
FROM rust:1.75 AS builder
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo 'fn main() {}' > src/main.rs
RUN cargo build --release
RUN rm -rf src
COPY src/ src/
RUN touch src/main.rs && cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/myapp /usr/local/bin/myapp
CMD ["myapp"]
```

### docker-compose.yml

```yaml
services:
  api:
    build: .
    ports:
      - "8080:8080"
    env_file:
      - .env
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-myapp}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-secret}
      POSTGRES_DB: ${POSTGRES_DB:-myapp}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./migrations/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-myapp}"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
    command: redis-server --appendonly yes

volumes:
  pgdata:
  redisdata:
```

### .env

```
DATABASE_URL=postgres://myapp:secret@db:5432/myapp
REDIS_URL=redis://redis:6379
RUST_LOG=info
PORT=8080
POSTGRES_USER=myapp
POSTGRES_PASSWORD=secret
POSTGRES_DB=myapp
```

---

## Development Workflow

### Development compose override

Create `docker-compose.override.yml` for development-specific settings. Compose automatically merges it with `docker-compose.yml`:

```yaml
services:
  api:
    build:
      context: .
      dockerfile: Dockerfile.dev
    volumes:
      - ./src:/app/src
      - ./Cargo.toml:/app/Cargo.toml
    environment:
      RUST_LOG: debug
      RUST_BACKTRACE: 1
```

### Common workflow

```bash
# Start everything
docker compose up -d

# Check status
docker compose ps

# Watch API logs
docker compose logs -f api

# Connect to database
docker compose exec db psql -U myapp

# Run migrations
docker compose exec api sqlx migrate run

# Rebuild after code changes
docker compose up -d --build api

# Reset database (warning: destroys data)
docker compose down -v
docker compose up -d

# Stop everything
docker compose down
```

### Running one-off commands

```bash
docker compose run --rm api cargo test
docker compose run --rm api cargo clippy
docker compose exec db pg_dump -U myapp myapp > backup.sql
```

---

## Tips

### Variable substitution

Compose files support environment variable substitution:

```yaml
services:
  db:
    image: postgres:${POSTGRES_VERSION:-16}-alpine
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set}
```

- `${VAR:-default}` — use default if unset
- `${VAR:?error message}` — error if unset

### Profiles

Run different sets of services:

```yaml
services:
  api:
    build: .

  db:
    image: postgres:16-alpine

  monitoring:
    image: grafana/grafana
    profiles:
      - monitoring

  debug-tools:
    image: nicolaka/netshoot
    profiles:
      - debug
```

```bash
docker compose up -d                           # only api and db
docker compose --profile monitoring up -d      # api, db, and monitoring
docker compose --profile debug up -d           # api, db, and debug tools
```

### Watching for changes (Compose Watch)

Docker Compose 2.22+ has built-in file watching:

```yaml
services:
  api:
    build: .
    develop:
      watch:
        - action: rebuild
          path: ./src
        - action: sync
          path: ./config
          target: /app/config
```

```bash
docker compose watch                           # auto-rebuild on file changes
```

---

## Exercises

### Exercise 1: Create a basic Compose setup

```bash
mkdir -p /tmp/compose-exercise
cd /tmp/compose-exercise

cat > docker-compose.yml <<'EOF'
services:
  web:
    image: nginx:alpine
    ports:
      - "8888:80"
    volumes:
      - ./html:/usr/share/nginx/html:ro

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: testdb
    ports:
      - "5433:5432"
    volumes:
      - dbdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  dbdata:
EOF

mkdir html
echo "<h1>Hello from Docker Compose</h1>" > html/index.html

docker compose up -d
docker compose ps
curl http://localhost:8888
docker compose exec db psql -U postgres -d testdb -c "SELECT 1 AS test;"
docker compose logs

# Clean up
docker compose down -v
rm -rf /tmp/compose-exercise
```

### Exercise 2: Multi-service with dependencies

```bash
mkdir -p /tmp/compose-deps
cd /tmp/compose-deps

cat > docker-compose.yml <<'EOF'
services:
  app:
    image: alpine
    command: sh -c "echo 'Waiting for db...' && sleep 2 && echo 'App started. DB is at db:5432'"
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: secret
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 2s
      timeout: 2s
      retries: 10
EOF

# Watch the startup order
docker compose up

# Notice how app waits for db to be healthy

# Clean up
docker compose down
rm -rf /tmp/compose-deps
```

### Exercise 3: Networking between services

```bash
mkdir -p /tmp/compose-network
cd /tmp/compose-network

cat > docker-compose.yml <<'EOF'
services:
  server:
    image: nginx:alpine

  client:
    image: alpine
    command: sh -c "apk add --no-cache curl && curl -s http://server:80 && echo '--- Success: client reached server by hostname ---'"
    depends_on:
      - server
EOF

docker compose up

# Clean up
docker compose down
rm -rf /tmp/compose-network
```

---

Next: [Lesson 15 — Networking on Linux](./15-linux-networking.md)
