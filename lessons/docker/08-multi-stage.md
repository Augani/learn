# Lesson 08: Multi-Stage Builds

---

## The Factory-to-Customer Analogy

Think about how a car goes from factory to customer. In the factory,
there are welding robots, paint booths, diagnostic computers, tooling
stations, and thousands of specialized tools. The factory floor is huge,
messy, and full of things the customer never needs.

The customer gets a clean, finished car. No welding robots. No paint
booth. Just the car, ready to drive.

Multi-stage builds work the same way. The build stage is the factory —
it has compilers, build tools, dev dependencies, test frameworks, and
source code. The final stage is what ships to production — just the
compiled binary or built assets. Nothing else.

Without multi-stage builds, you'd ship the entire factory to the
customer. That's what a naive Dockerfile does: your production image
includes the Go compiler, the TypeScript compiler, all dev dependencies,
test files, and source code. None of that needs to be there.

---

## How Multi-Stage Builds Work

A multi-stage Dockerfile has multiple `FROM` instructions. Each `FROM`
starts a new build stage. You can copy artifacts from one stage to
another using `COPY --from=`.

```dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY . .
RUN go build -o /server ./cmd/server

FROM alpine:3.19
COPY --from=builder /server /server
CMD ["/server"]
```

Two stages:
1. **builder**: Has Go toolchain (~300MB). Compiles the code.
2. **final**: Has only Alpine (~7MB) and the compiled binary (~15MB).

The builder stage is discarded after the build. It never appears in the
final image. Only the artifacts you explicitly COPY make it through.

```
Builder stage (discarded):
├── golang:1.22-alpine     (300MB)
├── Go source code         (5MB)
├── Go build cache         (200MB)
├── Go module cache        (150MB)
└── Compiled binary        (15MB)

Final image (shipped):
├── alpine:3.19            (7MB)
└── Compiled binary        (15MB)
                   Total:  22MB vs 670MB+
```

---

## The Builder Pattern for Go

Go is the poster child for multi-stage builds. Go produces static
binaries that need no runtime, no interpreter, no libraries (with
`CGO_ENABLED=0`). You can literally run a Go binary in an empty
container.

### Basic Go Multi-Stage

```dockerfile
FROM golang:1.22-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download && go mod verify

COPY . .

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-s -w" -o /server ./cmd/server

FROM scratch

COPY --from=builder /server /server

ENTRYPOINT ["/server"]
```

**`CGO_ENABLED=0`** — Disable cgo. The binary won't link against libc.
It's completely static and can run on `scratch` (empty image).

**`-ldflags="-s -w"`** — Strip debug symbols (`-s`) and DWARF info
(`-w`). Reduces binary size by 20-30%.

**`FROM scratch`** — Empty image. Zero bytes. No shell, no libc, no
nothing. Just your binary.

### Production Go Multi-Stage

The basic version is missing some essentials:

```dockerfile
FROM golang:1.22-alpine AS builder

RUN apk add --no-cache git ca-certificates tzdata

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download && go mod verify

COPY . .

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build \
    -ldflags="-s -w -X main.version=$(git describe --tags --always) -X main.buildTime=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    -o /server \
    ./cmd/server

FROM scratch

COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo
COPY --from=builder /etc/passwd /etc/passwd
COPY --from=builder /server /server

USER 65534

EXPOSE 8080

ENTRYPOINT ["/server"]
```

What's added:

**CA certificates** — Without these, your Go app can't make HTTPS
requests. TLS verification fails. You'll get `x509: certificate signed
by unknown authority` errors.

**Timezone data** — Without this, `time.LoadLocation("America/New_York")`
fails. Many applications need timezone support.

**`/etc/passwd`** — Needed for the USER instruction on scratch. The
nobody user (UID 65534) exists in Alpine's `/etc/passwd`.

**`-X main.version=...`** — Injects build metadata into the binary at
compile time. Your `/version` endpoint can report the exact git tag and
build time.

**`USER 65534`** — Run as nobody. Even on scratch, you should avoid
running as root.

### Image Size Comparison

```bash
docker build -t go-naive -f Dockerfile.naive .
docker build -t go-multi -f Dockerfile.multi .
docker images --format "table {{.Repository}}\t{{.Size}}"
```

```
REPOSITORY  SIZE
go-naive    835MB
go-multi    22MB
```

835MB → 22MB. That's a 97% reduction. The 835MB image includes the
entire Go compiler and standard library. The 22MB image has just your
binary and certificate data.

---

## The Builder Pattern for Node.js

Node.js can't compile to a static binary (yet — there's experimental
single executable support). You still need the Node.js runtime. But you
don't need TypeScript, build tools, or dev dependencies.

### Three-Stage Node.js Build

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
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app

COPY --from=deps --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/dist ./dist
COPY --chown=app:app package.json ./

USER app
ENV NODE_ENV=production

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server.js"]
```

**Stage 1 (`deps`)**: Install production dependencies ONLY. No
TypeScript, no eslint, no jest, no dev tooling. Just the packages your
app needs at runtime.

**Stage 2 (`builder`)**: Install ALL dependencies (need TypeScript
compiler), compile TypeScript to JavaScript.

**Stage 3 (final)**: Clean image with production node_modules from stage
1 and compiled JS from stage 2.

### Why Three Stages Instead of Two?

Two-stage build:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --production

FROM node:20-alpine
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
```

Problem: `npm prune --production` removes dev dependencies but leaves
artifacts and doesn't always clean up perfectly. A separate `deps` stage
that only installs production dependencies is cleaner and more
predictable.

### Image Size Comparison

```bash
docker build -t node-naive -f Dockerfile.naive .
docker build -t node-multi -f Dockerfile.multi .
docker images --format "table {{.Repository}}\t{{.Size}}"
```

```
REPOSITORY  SIZE
node-naive  456MB
node-multi  178MB
```

The naive image includes TypeScript, eslint, jest, ts-node, all dev
dependencies, source files, and build artifacts. The multi-stage image
has only what's needed to run.

---

## Building a Full-Stack Application

Real applications often have a Go/Node backend and a frontend (React,
Vue, etc.). Multi-stage builds can handle both:

```dockerfile
FROM node:20-alpine AS frontend-builder
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM golang:1.22-alpine AS backend-builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /server ./cmd/server

FROM scratch
COPY --from=backend-builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=backend-builder /server /server
COPY --from=frontend-builder /frontend/dist /static

EXPOSE 8080
ENTRYPOINT ["/server"]
```

Three build stages, one final image. With BuildKit, the frontend and
backend stages build in parallel because they're independent.

The Go server serves the static frontend files from `/static`. One
container, one image, one deployment.

---

## Copying Artifacts Between Stages

### Copy from Named Stages

```dockerfile
FROM golang:1.22-alpine AS builder
RUN go build -o /myapp

FROM scratch
COPY --from=builder /myapp /myapp
```

### Copy from External Images

You can copy files from any image, not just build stages:

```dockerfile
FROM scratch
COPY --from=golang:1.22-alpine /usr/local/go/bin/go /usr/local/bin/go
```

This copies the Go binary from the official Go image into your scratch
image. Useful for pulling specific binaries without running a full build
stage.

### Copy Multiple Artifacts

```dockerfile
FROM builder AS compiled
COPY --from=builder /server /server
COPY --from=builder /worker /worker
COPY --from=builder /migrator /migrator
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
```

A Go project might produce multiple binaries. Copy all of them into the
final image.

---

## Distroless Images

Google's distroless images are an alternative to `scratch` that includes
a minimal set of runtime files without a shell, package manager, or other
OS utilities.

### What's in Distroless?

- CA certificates
- Timezone data
- Some basic system libraries
- Nothing else. No shell, no `ls`, no `cat`, no `bash`.

### Go with Distroless

```dockerfile
FROM golang:1.22 AS builder
WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 go build -o /server ./cmd/server

FROM gcr.io/distroless/static-debian12
COPY --from=builder /server /server
ENTRYPOINT ["/server"]
```

`distroless/static` is for static binaries (Go with CGO_ENABLED=0).
It's slightly larger than `scratch` but includes certificates and timezone
data — no need to copy them manually.

### Node.js with Distroless

```dockerfile
FROM node:20 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --production

FROM gcr.io/distroless/nodejs20-debian12
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
CMD ["dist/server.js"]
```

`distroless/nodejs20` includes the Node.js runtime but nothing else.
No npm, no shell, no package manager.

### Debugging Distroless

Since there's no shell, you can't `docker exec -it container sh`. Use
the debug variants for troubleshooting:

```dockerfile
FROM gcr.io/distroless/static-debian12:debug
```

The debug variant includes a busybox shell at `/busybox/sh`.

### Size Comparison

| Base Image | Size | Shell | Pkg Manager |
|-----------|------|-------|-------------|
| `ubuntu:22.04` | 77MB | Yes | Yes |
| `alpine:3.19` | 7MB | Yes | Yes |
| `distroless/static` | 2MB | No | No |
| `scratch` | 0B | No | No |

---

## Targeting Specific Stages

You can build only a specific stage:

```dockerfile
FROM node:20-alpine AS development
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npx", "nodemon", "src/server.ts"]

FROM node:20-alpine AS testing
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["npm", "test"]

FROM node:20-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY dist/ ./dist/
USER node
CMD ["node", "dist/server.js"]
```

```bash
docker build --target development -t myapp:dev .
docker build --target testing -t myapp:test .
docker build --target production -t myapp:prod .
```

One Dockerfile, three purposes. Development includes hot-reloading.
Testing includes test dependencies. Production is minimal.

---

## Advanced Patterns

### Pattern: Test Gate

Only build the production image if tests pass:

```dockerfile
FROM golang:1.22-alpine AS test
WORKDIR /app
COPY . .
RUN go test -v ./...

FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 go build -o /server ./cmd/server

FROM scratch
COPY --from=test /dev/null /dev/null
COPY --from=builder /server /server
ENTRYPOINT ["/server"]
```

The `COPY --from=test /dev/null /dev/null` line forces Docker to run
the test stage before proceeding. If tests fail, the build fails.

### Pattern: Conditional Stages with ARG

```dockerfile
ARG TARGET=production

FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

FROM base AS development
RUN npm install
COPY . .
CMD ["npx", "nodemon"]

FROM base AS production
RUN npm ci --omit=dev
COPY dist/ ./dist/
CMD ["node", "dist/server.js"]
```

```bash
docker build --target development -t myapp:dev .
docker build --target production -t myapp:prod .
```

### Pattern: Binary Extraction

Build a binary and extract it without creating a final image:

```bash
docker build --target builder -o type=local,dest=./bin .
```

This copies the builder stage's output to your local `./bin` directory.
Useful for CI/CD when you want the binary but not the image.

### Pattern: Cross-Compilation

Build for multiple architectures:

```dockerfile
FROM --platform=$BUILDPLATFORM golang:1.22-alpine AS builder

ARG TARGETOS
ARG TARGETARCH

WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} \
    go build -o /server ./cmd/server

FROM scratch
COPY --from=builder /server /server
ENTRYPOINT ["/server"]
```

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t myapp .
```

Builds for both AMD64 and ARM64 in a single command. The Go compiler
cross-compiles natively.

---

## Real-World Image Size Comparisons

Let's look at the same Go API with different strategies:

```bash
# No optimization
FROM golang:1.22
COPY . .
RUN go build -o server ./cmd/server
CMD ["./server"]
# Result: 835MB

# Multi-stage, Ubuntu final
FROM golang:1.22-alpine AS builder
# ... build steps ...
FROM ubuntu:22.04
COPY --from=builder /server /server
CMD ["/server"]
# Result: 95MB

# Multi-stage, Alpine final
FROM golang:1.22-alpine AS builder
# ... build steps ...
FROM alpine:3.19
COPY --from=builder /server /server
CMD ["/server"]
# Result: 22MB

# Multi-stage, distroless
FROM golang:1.22-alpine AS builder
# ... build steps ...
FROM gcr.io/distroless/static-debian12
COPY --from=builder /server /server
CMD ["/server"]
# Result: 17MB

# Multi-stage, scratch
FROM golang:1.22-alpine AS builder
# ... build steps ...
FROM scratch
COPY --from=builder /server /server
ENTRYPOINT ["/server"]
# Result: 15MB
```

| Strategy | Image Size | Reduction |
|----------|-----------|-----------|
| No optimization | 835MB | Baseline |
| Ubuntu final | 95MB | 89% |
| Alpine final | 22MB | 97% |
| Distroless final | 17MB | 98% |
| Scratch final | 15MB | 98% |

For Node.js:

| Strategy | Image Size | Reduction |
|----------|-----------|-----------|
| No optimization | 456MB | Baseline |
| Multi-stage Alpine | 178MB | 61% |
| Multi-stage distroless | 165MB | 64% |

Node.js can't match Go's tiny images because it needs the Node runtime.
But the reduction is still significant.

---

## Exercises

### Exercise 1: Go Scratch Image

Write a multi-stage Dockerfile for this Go program:

```go
package main

import (
    "crypto/tls"
    "encoding/json"
    "fmt"
    "net/http"
    "os"
    "time"
)

func main() {
    resp, err := http.Get("https://httpbin.org/get")
    if err != nil {
        fmt.Fprintf(os.Stderr, "HTTPS request failed: %v\n", err)
        os.Exit(1)
    }
    defer resp.Body.Close()

    var result map[string]interface{}
    json.NewDecoder(resp.Body).Decode(&result)

    fmt.Printf("Status: %d\n", resp.StatusCode)
    fmt.Printf("TLS Version: %d\n", resp.TLS.Version)

    loc, _ := time.LoadLocation("America/New_York")
    fmt.Printf("NYC time: %s\n", time.Now().In(loc).Format(time.RFC3339))
}
```

Requirements:
- Final image must be FROM scratch
- Must be able to make HTTPS requests (needs CA certs)
- Must support timezone lookups (needs tzdata)
- Image must be under 20MB

Verify it works:

```bash
docker build -t go-scratch-exercise .
docker run --rm go-scratch-exercise
```

### Exercise 2: Node.js Three-Stage Build

Create a TypeScript Express app and build it with three stages:

Stage 1 (`deps`): Production node_modules only
Stage 2 (`builder`): Compile TypeScript
Stage 3 (final): Minimal runtime image

Requirements:
- Non-root user
- Tini for signal handling
- Image under 200MB
- Health check included

### Exercise 3: Image Size Olympics

For the same Go application, build five images:
1. `FROM golang:1.22` (no multi-stage)
2. `FROM golang:1.22` → `FROM ubuntu:22.04`
3. `FROM golang:1.22-alpine` → `FROM alpine:3.19`
4. `FROM golang:1.22-alpine` → `FROM gcr.io/distroless/static`
5. `FROM golang:1.22-alpine` → `FROM scratch`

Compare sizes:

```bash
docker images --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}" | grep exercise
```

### Exercise 4: Multi-Service Build

Create a monorepo-style Dockerfile that builds three binaries from the
same Go codebase:

```
cmd/
├── api/main.go
├── worker/main.go
└── migrator/main.go
```

Write a Dockerfile that:
1. Compiles all three binaries in a builder stage
2. Creates three separate final images (using `--target`)

```dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 go build -o /api ./cmd/api
RUN CGO_ENABLED=0 go build -o /worker ./cmd/worker
RUN CGO_ENABLED=0 go build -o /migrator ./cmd/migrator

FROM scratch AS api
COPY --from=builder /api /api
ENTRYPOINT ["/api"]

FROM scratch AS worker
COPY --from=builder /worker /worker
ENTRYPOINT ["/worker"]

FROM scratch AS migrator
COPY --from=builder /migrator /migrator
ENTRYPOINT ["/migrator"]
```

```bash
docker build --target api -t myapp-api .
docker build --target worker -t myapp-worker .
docker build --target migrator -t myapp-migrator .
```

### Exercise 5: Debug vs Production

Create a Dockerfile with both debug and production targets:

```dockerfile
FROM golang:1.22-alpine AS builder-debug
WORKDIR /app
COPY . .
RUN go build -gcflags="all=-N -l" -o /server-debug ./cmd/server

FROM golang:1.22-alpine AS builder-prod
WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /server-prod ./cmd/server

FROM golang:1.22-alpine AS debug
RUN apk add --no-cache delve
COPY --from=builder-debug /server-debug /server
EXPOSE 8080 2345
CMD ["dlv", "--listen=:2345", "--headless=true", "--api-version=2", "exec", "/server"]

FROM scratch AS production
COPY --from=builder-prod /server-prod /server
ENTRYPOINT ["/server"]
```

Build and compare:

```bash
docker build --target debug -t myapp:debug .
docker build --target production -t myapp:prod .
docker images myapp
```

The debug image has delve for remote debugging. The production image has
nothing but the binary.

---

## What Would Happen If...

**Q: You reference a stage that doesn't exist?**

Build fails with an error. `COPY --from=nonexistent` causes
"invalid from flag value nonexistent."

**Q: You have a circular dependency between stages?**

Not possible. Dockerfiles are processed top-to-bottom. A stage can only
reference stages defined before it.

**Q: The builder stage build fails but the final stage doesn't reference it?**

If you're using `--target final`, BuildKit only builds stages that are
needed. If `final` doesn't reference `builder`, BuildKit skips `builder`
entirely. The legacy builder might still build it.

**Q: You COPY a large file from a builder stage but it doesn't exist?**

Build fails. `COPY --from=builder /nonexistent /dest` causes a build
error.

**Q: Your scratch-based Go image can't resolve DNS?**

If your Go binary is statically linked (`CGO_ENABLED=0`), it uses Go's
pure-Go DNS resolver, which doesn't need `/etc/resolv.conf`. But if you
compiled with CGO enabled, it uses libc's resolver, which needs
`/etc/resolv.conf`, `/etc/nsswitch.conf`, and libc itself — none of
which exist on scratch.

**Q: You push a multi-stage image. Does the registry store the builder stage?**

No. Only the final stage is tagged and pushed. Builder stages are
intermediate and are not included in the pushed image.

---

## Key Takeaways

1. Multi-stage builds separate the build environment (compilers, tools,
   source code) from the runtime environment (just the output). Ship
   the car, not the factory.

2. Go apps can run on `scratch` (empty image) because Go produces static
   binaries. Just remember CA certificates and timezone data.

3. Node.js apps need the Node runtime, but multi-stage builds eliminate
   dev dependencies, TypeScript, test files, and build artifacts.

4. Use `--target` to build specific stages for different purposes:
   development, testing, production, debugging.

5. BuildKit builds independent stages in parallel. Structure your
   Dockerfile to maximize parallelism.

6. Distroless images are a practical middle ground between scratch
   (nothing) and Alpine (minimal OS). They include just enough to run
   most applications.

---

## Next Lesson

The final piece of the image puzzle: choosing the right base image.
Lesson 09 compares Alpine, Debian, Ubuntu, distroless, and scratch —
their trade-offs, gotchas, and when to use each one.
