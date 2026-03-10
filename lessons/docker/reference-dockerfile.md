# Dockerfile Best Practices — Cheat Sheet

---

## Instruction Order for Cache Optimization

Think of Docker's build cache like a row of dominoes. The moment one domino
falls (a layer invalidates), every domino after it falls too. Put the things
that change **least often** at the top, and the things that change **most
often** at the bottom.

### Optimal Order

```dockerfile
FROM golang:1.22-alpine

LABEL maintainer="you@example.com"
LABEL version="1.0"

ARG BUILD_ENV=production

ENV APP_PORT=8080

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 go build -o /app/server ./cmd/server

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://localhost:8080/health || exit 1

ENTRYPOINT ["/app/server"]
CMD ["--port", "8080"]
```

### Why This Order Works

| Position | Instruction | Change Frequency |
|----------|------------|-----------------|
| Top | FROM, LABEL | Almost never |
| | ARG, ENV | Rarely |
| | RUN (install deps) | Occasionally |
| | WORKDIR | Never |
| | COPY go.mod / package.json | When deps change |
| | RUN (download deps) | When deps change |
| | COPY . . | Every code change |
| Bottom | RUN (build), CMD | Every code change |

---

## .dockerignore Patterns

The `.dockerignore` file works like `.gitignore` — it prevents files from
entering the build context. Without it, Docker sends **everything** in your
project directory to the daemon, including that 2GB `node_modules` folder.

### Essential .dockerignore

```
# Version control
.git
.gitignore

# Docker files (prevent recursive nonsense)
Dockerfile*
docker-compose*.yml
.dockerignore

# Dependencies (will be installed fresh in container)
node_modules
vendor

# Build artifacts
dist
build
*.exe
*.dll
*.so
*.dylib

# IDE and editor files
.vscode
.idea
*.swp
*.swo
*~

# OS files
.DS_Store
Thumbs.db

# Environment and secrets — NEVER ship these
.env
.env.*
*.pem
*.key
credentials.json

# Test and documentation
coverage
*.test.js
*.spec.ts
__tests__
docs
README.md

# Logs
*.log
logs
```

### Pattern Syntax

```
# Wildcard — matches any sequence of characters
*.log

# Double star — matches any number of directories
**/*.test.js

# Negation — re-include something previously excluded
*.md
!README.md

# Directory — exclude entire directory
node_modules

# Single character wildcard
temp?.txt
```

### Common Mistake

Forgetting `.dockerignore` and wondering why your build takes 45 seconds
to send context:

```
Sending build context to Docker daemon  847.3MB
```

With a proper `.dockerignore`:

```
Sending build context to Docker daemon  12.4kB
```

---

## ARG vs ENV

Think of ARG as a **construction-time** decision (what color to paint the
walls while building the house) and ENV as a **living-time** setting (the
thermostat setting for whoever lives there).

### ARG — Build-Time Variables

```dockerfile
ARG GO_VERSION=1.22
FROM golang:${GO_VERSION}-alpine

ARG BUILD_DATE
ARG GIT_SHA

RUN echo "Built on ${BUILD_DATE} from ${GIT_SHA}"
```

```bash
docker build \
  --build-arg GO_VERSION=1.21 \
  --build-arg BUILD_DATE=$(date -u +%Y-%m-%d) \
  --build-arg GIT_SHA=$(git rev-parse --short HEAD) \
  .
```

**Key facts about ARG:**
- Available ONLY during build
- NOT present in the running container
- Resets after each FROM in multi-stage builds
- Visible in `docker history` (don't put secrets here)
- Has a default value if specified, otherwise must be provided

### ENV — Runtime Variables

```dockerfile
ENV NODE_ENV=production
ENV APP_PORT=3000
ENV LOG_LEVEL=info
```

```bash
docker run -e APP_PORT=4000 -e LOG_LEVEL=debug myapp
```

**Key facts about ENV:**
- Available during build AND at runtime
- Persists in the running container
- Can be overridden with `docker run -e`
- Visible in `docker inspect`
- Baked into the image layer

### Combining ARG and ENV

```dockerfile
ARG DEFAULT_PORT=8080
ENV APP_PORT=${DEFAULT_PORT}
```

This lets you set a build-time default that becomes a runtime variable.

### Quick Reference

| Feature | ARG | ENV |
|---------|-----|-----|
| Available during build | Yes | Yes |
| Available at runtime | No | Yes |
| Set from CLI | `--build-arg` | `-e` or `--env` |
| Visible in history | Yes | Yes |
| Resets per stage | Yes | No |
| Good for secrets | No | No |

---

## ENTRYPOINT vs CMD

Analogy: ENTRYPOINT is the **verb** (what the container does), CMD is the
**default noun** (what it does it to). Together they form a sentence.

### CMD Alone — Fully Overridable

```dockerfile
CMD ["node", "server.js"]
```

```bash
docker run myapp                    # runs: node server.js
docker run myapp node --version     # runs: node --version (CMD replaced)
docker run myapp bash               # runs: bash (CMD replaced)
```

### ENTRYPOINT Alone — Fixed Command

```dockerfile
ENTRYPOINT ["node", "server.js"]
```

```bash
docker run myapp                    # runs: node server.js
docker run myapp --port 3000        # runs: node server.js --port 3000
```

### ENTRYPOINT + CMD — Best of Both

```dockerfile
ENTRYPOINT ["node", "server.js"]
CMD ["--port", "3000"]
```

```bash
docker run myapp                    # runs: node server.js --port 3000
docker run myapp --port 4000        # runs: node server.js --port 4000
```

### Shell Form vs Exec Form

```dockerfile
# Exec form (preferred) — runs as PID 1, receives signals
ENTRYPOINT ["node", "server.js"]

# Shell form — runs inside /bin/sh -c, does NOT receive signals
ENTRYPOINT node server.js
```

**Always use exec form.** Shell form wraps your process in a shell, which
means SIGTERM goes to the shell, not your app. Your app never gets a
graceful shutdown signal.

### Quick Reference

| Scenario | Use |
|----------|-----|
| General-purpose image | CMD alone |
| Single-purpose tool | ENTRYPOINT + CMD for defaults |
| Wrapper script | ENTRYPOINT for script, CMD for default args |

---

## COPY vs ADD

### COPY — Use This 99% of the Time

```dockerfile
COPY package.json package-lock.json ./
COPY src/ ./src/
COPY --chown=node:node . .
```

COPY does exactly one thing: copies files from the build context into the
image. No surprises.

### ADD — Two Extra Tricks (Usually Unwanted)

```dockerfile
ADD https://example.com/file.tar.gz /app/
ADD archive.tar.gz /app/
```

ADD can:
1. Download files from URLs (use `curl` or `wget` instead for cacheability)
2. Auto-extract tar archives (sometimes useful, often surprising)

### When to Use ADD

The only legitimate use: auto-extracting a local tar archive.

```dockerfile
ADD rootfs.tar.gz /
```

For everything else, use COPY.

---

## HEALTHCHECK

Tells Docker how to test if your container is actually working, not just
running. Like checking if a restaurant is open vs checking if anyone is
actually cooking.

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1
```

### Parameters

| Parameter | Default | Purpose |
|-----------|---------|---------|
| `--interval` | 30s | Time between checks |
| `--timeout` | 30s | Max time for a single check |
| `--start-period` | 0s | Grace period for container startup |
| `--retries` | 3 | Consecutive failures before "unhealthy" |

### Health States

- **starting** — within start-period, not yet healthy
- **healthy** — check passed
- **unhealthy** — retries exceeded, check keeps failing

### For Go APIs

```dockerfile
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s \
  CMD wget -qO- http://localhost:8080/healthz || exit 1
```

### For Node.js APIs

```dockerfile
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s \
  CMD node -e "fetch('http://localhost:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
```

### Disable Health Check (inherited from base)

```dockerfile
HEALTHCHECK NONE
```

---

## LABEL

Metadata for your images. Costs nothing, helps everything.

```dockerfile
LABEL org.opencontainers.image.title="My API"
LABEL org.opencontainers.image.description="Production API server"
LABEL org.opencontainers.image.version="1.2.3"
LABEL org.opencontainers.image.created="2024-01-15T10:30:00Z"
LABEL org.opencontainers.image.source="https://github.com/you/repo"
LABEL org.opencontainers.image.authors="you@example.com"
```

Query labels:

```bash
docker inspect --format '{{json .Config.Labels}}' myimage | jq
```

---

## Multi-Stage Patterns

### Pattern 1: Build and Run (Go)

```dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /server ./cmd/server

FROM scratch
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /server /server
ENTRYPOINT ["/server"]
```

### Pattern 2: Build and Serve (Node.js)

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production

FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

### Pattern 3: Test Then Build

```dockerfile
FROM golang:1.22-alpine AS test
WORKDIR /app
COPY . .
RUN go test ./...

FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 go build -o /server ./cmd/server

FROM scratch
COPY --from=builder /server /server
ENTRYPOINT ["/server"]
```

### Pattern 4: Shared Base

```dockerfile
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache tini
COPY package.json package-lock.json ./

FROM base AS development
RUN npm install
COPY . .
CMD ["npx", "nodemon", "src/server.ts"]

FROM base AS production
RUN npm ci --production
COPY dist/ ./dist/
USER node
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server.js"]
```

---

## Common Mistakes

### 1. Running as Root

```dockerfile
# BAD — runs as root by default
FROM node:20
COPY . .
CMD ["node", "server.js"]

# GOOD — create and use a non-root user
FROM node:20
RUN groupadd -r appuser && useradd -r -g appuser appuser
WORKDIR /app
COPY --chown=appuser:appuser . .
USER appuser
CMD ["node", "server.js"]
```

### 2. Not Cleaning Package Manager Cache

```dockerfile
# BAD — apt cache stays in the layer (100MB+)
RUN apt-get update && apt-get install -y curl

# GOOD — clean up in the same RUN instruction
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*
```

### 3. Using Latest Tag

```dockerfile
# BAD — "latest" is a moving target
FROM node:latest

# GOOD — pin to a specific version
FROM node:20.11.0-alpine3.19
```

### 4. COPY Before Dependencies

```dockerfile
# BAD — any code change invalidates dependency cache
COPY . .
RUN npm install

# GOOD — dependencies cached until package.json changes
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
```

### 5. Multiple RUN for Related Commands

```dockerfile
# BAD — creates unnecessary layers
RUN apt-get update
RUN apt-get install -y curl
RUN apt-get install -y wget
RUN rm -rf /var/lib/apt/lists/*

# GOOD — single layer, single cache entry
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl wget && \
    rm -rf /var/lib/apt/lists/*
```

### 6. Secrets in Build Args

```dockerfile
# BAD — visible in docker history
ARG DATABASE_PASSWORD
RUN echo "Connecting to db with $DATABASE_PASSWORD"

# GOOD — use BuildKit secrets
RUN --mount=type=secret,id=db_password \
    cat /run/secrets/db_password | connect-to-db
```

```bash
docker build --secret id=db_password,src=./db_password.txt .
```

### 7. Not Using .dockerignore

Without `.dockerignore`, your `.git` directory, `node_modules`, `.env`
files, and test fixtures all get sent to the Docker daemon. Every. Single.
Build.

### 8. Shell Form for ENTRYPOINT

```dockerfile
# BAD — process runs as child of /bin/sh, no signal forwarding
ENTRYPOINT npm start

# GOOD — process is PID 1, receives SIGTERM
ENTRYPOINT ["node", "dist/server.js"]
```

### 9. Not Setting WORKDIR

```dockerfile
# BAD — files scattered in /
COPY server.js .
COPY config/ .

# GOOD — organized workspace
WORKDIR /app
COPY server.js .
COPY config/ ./config/
```

### 10. Ignoring Layer Size

```dockerfile
# BAD — downloads and build tools stay in the image
RUN curl -L https://big-file.tar.gz -o /tmp/big.tar.gz && \
    tar xzf /tmp/big.tar.gz -C /opt/ && \
    /opt/big/configure && make && make install

# GOOD — clean up in the same RUN
RUN curl -L https://big-file.tar.gz -o /tmp/big.tar.gz && \
    tar xzf /tmp/big.tar.gz -C /opt/ && \
    /opt/big/configure && make && make install && \
    rm -rf /tmp/big.tar.gz /opt/big

# BEST — use multi-stage build
```
