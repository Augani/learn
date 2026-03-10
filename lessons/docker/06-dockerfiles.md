# Lesson 06: Writing Dockerfiles

---

## What Is a Dockerfile?

A Dockerfile is a recipe. It describes how to build a container image
step by step. Each instruction adds a layer to the image. The result is
a portable, reproducible environment for your application.

If you've ever written a shell script to set up a development machine
("install these packages, copy these files, set these environment
variables"), a Dockerfile is the formalized, cacheable version of that.

---

## The Core Instructions

### FROM — Choosing Your Starting Point

Every Dockerfile starts with FROM. It declares the base image — the
foundation your image is built on.

```dockerfile
FROM ubuntu:22.04
FROM node:20-alpine
FROM golang:1.22-alpine
FROM scratch
```

Think of FROM like choosing what apartment to move into. Ubuntu is a
fully furnished apartment (everything included, heavy). Alpine is a
minimalist studio (small, fast, bare). Scratch is an empty lot (literally
nothing — bring your own everything).

You can use multiple FROM instructions for multi-stage builds (lesson 08).

### RUN — Executing Commands

RUN executes a command during the build and commits the result as a new
layer.

```dockerfile
RUN apt-get update && apt-get install -y curl
RUN go mod download
RUN npm ci
```

Every RUN creates a layer. Combine related commands to reduce layers:

```dockerfile
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      curl \
      ca-certificates \
      tzdata && \
    rm -rf /var/lib/apt/lists/*
```

The `&&` chains commands. If any command fails, the build stops. The `\`
continues the line.

### COPY — Adding Files

COPY takes files from your build context (the directory you're building
from) and adds them to the image.

```dockerfile
COPY package.json package-lock.json ./
COPY src/ ./src/
COPY . .
```

The build context is the directory you specify in `docker build`:

```bash
docker build -t myapp .
```

That `.` is the build context. Docker sends everything in that directory
(minus `.dockerignore` patterns) to the daemon. Only files in the build
context can be COPYed.

### WORKDIR — Setting the Working Directory

```dockerfile
WORKDIR /app
```

Sets the working directory for subsequent RUN, CMD, ENTRYPOINT, COPY,
and ADD instructions. Like `cd` but persistent. If the directory doesn't
exist, it's created.

Always use WORKDIR instead of `RUN mkdir /app && cd /app`. WORKDIR is
explicit and works for all following instructions.

### EXPOSE — Documenting Ports

```dockerfile
EXPOSE 8080
EXPOSE 3000/tcp
EXPOSE 5432/udp
```

EXPOSE is purely documentation. It tells humans and tools which ports
the container listens on. It does NOT actually publish the port. You
still need `-p 8080:8080` at runtime.

Think of EXPOSE like a label on a power outlet: "220V." It tells you
what to expect but doesn't actually connect anything.

### CMD — Default Command

```dockerfile
CMD ["node", "server.js"]
CMD ["./server", "--port", "8080"]
```

CMD specifies what runs when the container starts, IF no other command
is given.

```bash
docker run myapp               # runs: node server.js (CMD)
docker run myapp npm test      # runs: npm test (CMD overridden)
```

Use exec form (JSON array) so your process is PID 1 and receives signals.

### ENTRYPOINT — Fixed Command

```dockerfile
ENTRYPOINT ["node", "server.js"]
```

ENTRYPOINT is the command that always runs. Arguments from `docker run`
are appended to it.

```bash
docker run myapp               # runs: node server.js
docker run myapp --port 4000   # runs: node server.js --port 4000
```

### ENTRYPOINT + CMD Together

```dockerfile
ENTRYPOINT ["./server"]
CMD ["--port", "8080", "--host", "0.0.0.0"]
```

ENTRYPOINT is the verb, CMD is the default arguments.

```bash
docker run myapp                                # runs: ./server --port 8080 --host 0.0.0.0
docker run myapp --port 3000 --host 127.0.0.1   # runs: ./server --port 3000 --host 127.0.0.1
```

### ENV — Environment Variables

```dockerfile
ENV NODE_ENV=production
ENV APP_PORT=3000
ENV LOG_LEVEL=info
```

Available during build AND at runtime. Override at runtime with `-e`:

```bash
docker run -e LOG_LEVEL=debug myapp
```

### ARG — Build-Time Variables

```dockerfile
ARG GO_VERSION=1.22
FROM golang:${GO_VERSION}-alpine

ARG BUILD_DATE
LABEL build-date=${BUILD_DATE}
```

Available ONLY during build. Disappear in the final image.

```bash
docker build --build-arg BUILD_DATE=$(date -u +%Y-%m-%d) -t myapp .
```

### USER — Running as Non-Root

```dockerfile
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
```

Switches the user for all subsequent instructions AND the runtime process.
Always do this in production images.

---

## Build Context — What Docker Sees

When you run `docker build .`, Docker packages the current directory into
a tar archive and sends it to the daemon. This is the "build context."

```bash
docker build -t myapp .
# Sending build context to Docker daemon  247.3MB
```

If that number is large, you're sending too much. Create a
`.dockerignore` file.

### .dockerignore

```
node_modules
.git
dist
*.log
.env
.env.*
Dockerfile
docker-compose.yml
.dockerignore
coverage
__tests__
*.test.js
*.spec.ts
.DS_Store
.vscode
.idea
```

With `.dockerignore`:

```bash
docker build -t myapp .
# Sending build context to Docker daemon  12.8kB
```

### Build Context Gotchas

You can't COPY files from outside the build context:

```dockerfile
COPY ../shared/utils.go ./utils.go
```

This fails. The build context is a boundary. If you need files from a
parent directory, set the build context to the parent:

```bash
docker build -t myapp -f services/api/Dockerfile .
```

Now the build context is `.` (the root), and the Dockerfile is at
`services/api/Dockerfile`.

---

## Building a Real Go API Image

Let's build a production-quality Docker image for a Go API, step by step.

### The Go Application

```
myapi/
├── cmd/
│   └── server/
│       └── main.go
├── internal/
│   └── handler/
│       └── health.go
├── go.mod
├── go.sum
├── Dockerfile
└── .dockerignore
```

### Step 1: Start with .dockerignore

```
.git
.gitignore
Dockerfile
docker-compose.yml
.dockerignore
*.md
.env
.env.*
bin/
tmp/
.vscode
.idea
```

### Step 2: The Dockerfile

```dockerfile
FROM golang:1.22-alpine AS builder

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download && go mod verify

COPY . .

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-s -w" \
    -o /server \
    ./cmd/server

FROM scratch

COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo
COPY --from=builder /server /server

EXPOSE 8080

ENTRYPOINT ["/server"]
```

### What Each Line Does

**`FROM golang:1.22-alpine AS builder`**
Start with Go installed on Alpine Linux. Name this stage "builder" for
reference later.

**`RUN apk add --no-cache ca-certificates tzdata`**
Install CA certificates (for HTTPS calls) and timezone data. `--no-cache`
avoids storing the package index (saves space).

**`WORKDIR /app`**
Create and switch to /app directory.

**`COPY go.mod go.sum ./`**
Copy ONLY the dependency files first. This is crucial for caching — if
your Go code changes but dependencies don't, this layer is cached.

**`RUN go mod download && go mod verify`**
Download dependencies. Cached until go.mod/go.sum change.

**`COPY . .`**
Now copy all source code. This layer invalidates on any code change, but
the dependency layer above remains cached.

**`RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build ...`**
Build a static binary. `-ldflags="-s -w"` strips debug symbols (smaller
binary). `CGO_ENABLED=0` ensures no dynamic linking — the binary is
completely standalone.

**`FROM scratch`**
Start a new stage from an empty image. Nothing — no shell, no libc, no
utilities.

**`COPY --from=builder ...`**
Copy only the artifacts we need from the builder stage: certificates,
timezone data, and the binary.

**`ENTRYPOINT ["/server"]`**
Run the binary when the container starts.

### Build and Test

```bash
docker build -t myapi:v1 .
docker images myapi:v1
```

```
REPOSITORY  TAG  IMAGE ID      SIZE
myapi       v1   a1b2c3d4e5f6  12.3MB
```

12MB for a complete Go API server. Compare to the 300MB+ you'd get
without multi-stage builds.

```bash
docker run -d --name api -p 8080:8080 myapi:v1
curl http://localhost:8080/healthz
docker rm -f api
```

---

## Building a Real Node.js API Image

### The Node.js Application

```
myapp/
├── src/
│   ├── server.ts
│   ├── routes/
│   │   └── health.ts
│   └── index.ts
├── package.json
├── package-lock.json
├── tsconfig.json
├── Dockerfile
└── .dockerignore
```

### Step 1: .dockerignore

```
node_modules
.git
.gitignore
Dockerfile
docker-compose.yml
.dockerignore
*.md
.env
.env.*
dist
coverage
__tests__
*.test.ts
*.spec.ts
.vscode
.idea
.DS_Store
```

### Step 2: The Dockerfile

```dockerfile
FROM node:20-alpine AS deps

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci
COPY src/ ./src/
RUN npm run build

FROM node:20-alpine

RUN apk add --no-cache tini

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY --from=deps --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --chown=appuser:appgroup package.json ./

USER appuser

ENV NODE_ENV=production

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server.js"]
```

### What Each Line Does

**Stage 1: `deps`**
Install only production dependencies. `npm ci --omit=dev` skips dev
dependencies (TypeScript, testing libraries, etc.). This gives us the
minimal `node_modules` for production.

**Stage 2: `builder`**
Install ALL dependencies (including dev for TypeScript compiler), then
build. `npm run build` compiles TypeScript to JavaScript in `dist/`.

**Stage 3: Final image**

**`RUN apk add --no-cache tini`**
Tini is a tiny init process that properly handles signals and reaps
zombie processes. Node.js as PID 1 doesn't handle these well.

**`RUN addgroup && adduser`**
Create a non-root user for security.

**`COPY --from=deps ... node_modules`**
Copy production-only `node_modules` from the deps stage.

**`COPY --from=builder ... dist`**
Copy compiled JavaScript from the builder stage.

**`ENTRYPOINT ["/sbin/tini", "--"]`**
Tini is PID 1. It handles signals and forwards them to Node.js.

**`CMD ["node", "dist/server.js"]`**
Node.js is the child of tini. It receives SIGTERM properly.

### Build and Test

```bash
docker build -t myapp:v1 .
docker images myapp:v1
```

```
REPOSITORY  TAG  IMAGE ID      SIZE
myapp       v1   b2c3d4e5f6a7  165MB
```

165MB with a full Node.js runtime and production dependencies. Without
multi-stage, it would include TypeScript, testing libraries, and dev
dependencies — easily 400MB+.

```bash
docker run -d --name app -p 3000:3000 myapp:v1
curl http://localhost:3000/health
docker rm -f app
```

---

## Common Mistakes and How to Fix Them

### Mistake 1: Running as Root

```dockerfile
FROM node:20
COPY . .
RUN npm install
CMD ["node", "server.js"]
```

This runs as root. If your app has a vulnerability that allows code
execution, the attacker has root access inside the container.

**Fix:** Create and switch to a non-root user.

```dockerfile
FROM node:20
RUN groupadd -r app && useradd -r -g app app
WORKDIR /app
COPY --chown=app:app . .
RUN npm ci
USER app
CMD ["node", "server.js"]
```

### Mistake 2: Not Cleaning apt/apk Cache

```dockerfile
RUN apt-get update
RUN apt-get install -y curl wget
```

Two problems: two separate layers, and the apt cache stays in the image.

**Fix:** Single layer, clean up afterward.

```dockerfile
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl wget && \
    rm -rf /var/lib/apt/lists/*
```

### Mistake 3: Copying node_modules Into the Image

```dockerfile
COPY . .
```

If `node_modules` exists in your local directory and isn't in
`.dockerignore`, it gets copied into the image. Then `npm install` adds
another copy. You end up with potentially conflicting or bloated
dependencies.

**Fix:** Add `node_modules` to `.dockerignore` and always install fresh
inside the image.

### Mistake 4: Using ADD Instead of COPY

```dockerfile
ADD . .
ADD https://example.com/config.json /app/
```

ADD has two hidden features: it auto-extracts tar files and can download
URLs. Both are usually surprising and unwanted.

**Fix:** Use COPY for files. Use RUN with curl/wget for downloads
(better caching control).

```dockerfile
COPY . .
RUN curl -o /app/config.json https://example.com/config.json
```

### Mistake 5: Not Pinning Base Image Versions

```dockerfile
FROM node:latest
```

"latest" is a moving target. Your build might work today and break
tomorrow when a new Node.js version is pushed.

**Fix:** Pin to a specific version.

```dockerfile
FROM node:20.11.0-alpine3.19
```

### Mistake 6: Not Using .dockerignore

Without `.dockerignore`, your `.git` directory (potentially 100MB+),
`node_modules` (potentially 500MB+), `.env` files (containing secrets),
and test fixtures all get sent as build context.

**Fix:** Always create `.dockerignore`. Start with the template from
earlier in this lesson.

### Mistake 7: Large Final Images

```dockerfile
FROM golang:1.22
WORKDIR /app
COPY . .
RUN go build -o server ./cmd/server
CMD ["./server"]
```

The final image includes the entire Go toolchain (~800MB). Your binary
is 15MB.

**Fix:** Multi-stage build (covered in detail in lesson 08).

### Mistake 8: Shell Form for CMD/ENTRYPOINT

```dockerfile
CMD npm start
ENTRYPOINT node server.js
```

Shell form wraps your command in `/bin/sh -c`, which means your app isn't
PID 1 and doesn't receive signals.

**Fix:** Always use exec form.

```dockerfile
CMD ["node", "server.js"]
ENTRYPOINT ["node", "server.js"]
```

### Mistake 9: Secrets in the Image

```dockerfile
COPY .env /app/.env
ENV DATABASE_PASSWORD=supersecret
```

Anyone who can pull your image can see these secrets.

**Fix:** Pass secrets at runtime via `-e` or `--env-file`, or use
Docker secrets/BuildKit secrets for build-time secrets.

```bash
docker run -e DATABASE_PASSWORD=supersecret myapp
docker run --env-file .env myapp
```

### Mistake 10: Ignoring Build Order

```dockerfile
COPY . .
RUN npm ci
```

Any file change (even a README edit) invalidates the npm install cache.

**Fix:** Copy dependency files first, install, then copy everything.

```dockerfile
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
```

---

## Exercises

### Exercise 1: Build a Go API Image

Create a minimal Go HTTP server and Dockerize it:

```go
package main

import (
    "encoding/json"
    "net/http"
    "os"
    "time"
)

func main() {
    mux := http.NewServeMux()

    mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
        json.NewEncoder(w).Encode(map[string]string{
            "status":   "ok",
            "hostname": mustHostname(),
            "time":     time.Now().UTC().Format(time.RFC3339),
        })
    })

    http.ListenAndServe(":8080", mux)
}

func mustHostname() string {
    h, _ := os.Hostname()
    return h
}
```

Write a Dockerfile that:
1. Uses multi-stage build
2. Produces a scratch-based image
3. Includes CA certificates
4. Results in an image under 15MB

### Exercise 2: Build a Node.js API Image

Create a simple Express server and Dockerize it:

```typescript
import express from 'express';

const app = express();
const port = process.env.PORT || 3000;

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    memory: process.memoryUsage().heapUsed,
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
```

Write a Dockerfile that:
1. Uses multi-stage build (deps, builder, final)
2. Runs as non-root user
3. Uses tini for signal handling
4. Results in an image under 200MB

### Exercise 3: Fix the Broken Dockerfile

This Dockerfile has at least 7 problems. Find and fix them all.

```dockerfile
FROM node:latest
ADD . .
RUN npm install
ENV API_KEY=sk-1234567890abcdef
EXPOSE 3000
CMD npm start
```

### Exercise 4: Optimize Build Context

Create a project with a large `.git` directory and `node_modules`. Build
without `.dockerignore` and note the build context size. Then add
`.dockerignore` and compare.

```bash
mkdir -p /tmp/context-test && cd /tmp/context-test
git init
dd if=/dev/zero of=bigfile bs=1M count=100
echo '{"name":"test"}' > package.json
echo 'FROM alpine' > Dockerfile
echo 'COPY . .' >> Dockerfile

docker build -t context-test .

echo "bigfile" > .dockerignore
echo ".git" >> .dockerignore

docker build -t context-test .
```

Compare the "Sending build context" sizes.

Clean up: `rm -rf /tmp/context-test && docker rmi context-test`

### Exercise 5: Debug a Container That Won't Start

Build and try to run this intentionally broken image:

```dockerfile
FROM alpine:3.19
RUN echo '#!/bin/sh' > /app.sh && echo 'cat /config/app.json' >> /app.sh
CMD ["sh", "/app.sh"]
```

It will fail because `/config/app.json` doesn't exist. Debug it:

```bash
docker build -t debug-exercise .
docker run debug-exercise

docker run -it debug-exercise sh

docker run -v $(pwd)/config.json:/config/app.json debug-exercise
```

How would you fix the Dockerfile to handle the missing file gracefully?

---

## What Would Happen If...

**Q: You COPY a symlink?**

COPY follows symlinks and copies the actual file content, not the link.
If the symlink points outside the build context, the build fails.

**Q: You have no CMD or ENTRYPOINT?**

The container exits immediately with no error. There's nothing to run.
If the base image has a CMD (like Ubuntu's `/bin/bash`), that runs
instead.

**Q: You use WORKDIR with a relative path?**

It's relative to the previous WORKDIR. `WORKDIR app` after `WORKDIR /src`
results in `/src/app`.

**Q: Your RUN command fails?**

The build stops. The layers from previous successful instructions are
cached. Fix the failing instruction and rebuild — Docker reuses the
cache up to the failure point.

**Q: You COPY a file that changes every build (like a build timestamp)?**

Every layer after that COPY is invalidated every build. Put volatile
files as late as possible in the Dockerfile.

---

## Key Takeaways

1. Every Dockerfile instruction that modifies the filesystem creates a
   layer. Minimize layers, especially large ones.

2. Order matters for caching. Put things that change rarely at the top
   (FROM, RUN install) and things that change often at the bottom
   (COPY source code).

3. Always use `.dockerignore` to keep the build context small and exclude
   secrets.

4. Always use exec form (`["cmd", "arg"]`) for CMD and ENTRYPOINT so
   your app is PID 1 and receives signals.

5. Never run as root in production. Create a non-root user and use USER.

6. Separate dependency installation from code copying for better cache
   utilization.

---

## Next Lesson

You've written Dockerfiles and seen layers being created. But how does
Docker decide when to use cached layers vs rebuild them? And why does
the order of instructions matter so much? Lesson 07 dives deep into
**image layers and build caching** — the mechanics that make or break
your build performance.
