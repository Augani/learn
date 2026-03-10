# Lesson 09: Choosing Base Images

---

## The Apartment Analogy

Choosing a base image is like choosing an apartment:

**Ubuntu/Debian** — A fully furnished apartment. Everything you could need
is already there or easy to get. Familiar layout, no surprises. But the
rent is high (large image size) and there's a lot of stuff you might
never use.

**Alpine** — An unfurnished minimalist studio. Small, cheap, efficient.
You bring only what you need. But some things don't fit the same way
(different wall outlets, different plumbing fittings), and you might
struggle to set up specialized equipment.

**Distroless** — A pre-built office pod. Has exactly what you need for
work (runtime, certificates, timezone data) and literally nothing else.
No kitchen, no bathroom — just a desk and a chair. You can't customize
it, but it's secure because there's nothing to break into.

**Scratch** — An empty lot. Build everything yourself. Maximum control,
minimum size. But you need to bring your own walls, floor, and roof. Only
works if you're completely self-sufficient (static binaries).

---

## The Options at a Glance

| Base Image | Size | Shell | Pkg Manager | libc | Security Surface |
|-----------|------|-------|-------------|------|-----------------|
| `ubuntu:22.04` | 77MB | bash | apt | glibc | Large |
| `debian:12-slim` | 74MB | bash | apt | glibc | Large |
| `alpine:3.19` | 7MB | sh | apk | musl | Small |
| `distroless/static` | 2MB | None | None | None | Minimal |
| `distroless/base` | 20MB | None | None | glibc | Small |
| `scratch` | 0B | None | None | None | None |

---

## Ubuntu and Debian — The Safe Choice

### When to Use

- You need packages that are complex to compile from source
- Your application depends on glibc-specific behavior
- You're running software that only provides Debian/Ubuntu packages
- You want the broadest compatibility with third-party libraries
- Your team is most familiar with apt-based systems

### Ubuntu Example

```dockerfile
FROM ubuntu:22.04

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      ca-certificates \
      curl && \
    rm -rf /var/lib/apt/lists/*

RUN groupadd -r app && useradd -r -g app app

WORKDIR /app
COPY --chown=app:app . .

USER app
CMD ["./server"]
```

### Debian Slim

Debian slim variants strip documentation, man pages, and locales:

```dockerfile
FROM debian:12-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      ca-certificates && \
    rm -rf /var/lib/apt/lists/*

COPY server /server
CMD ["/server"]
```

Debian slim is smaller than Ubuntu but larger than Alpine. It's a
middle ground: glibc compatibility with reduced size.

### The glibc Advantage

Ubuntu and Debian use GNU C Library (glibc). This is the standard C
library that most Linux software is compiled against. Using glibc means:

- Binary compatibility with virtually all Linux software
- No surprises with DNS resolution, locale handling, or threading
- Pre-built packages from massive repositories
- Well-tested, decades-old code paths

### The Size Problem

```bash
docker pull ubuntu:22.04
docker images ubuntu:22.04
```

```
REPOSITORY  TAG    SIZE
ubuntu      22.04  77.8MB
```

That's 77MB before you add anything. After installing a few packages,
you're easily at 200-300MB. For a Go binary that's 15MB, that's 20x
overhead.

---

## Alpine — The Lightweight Champion

### When to Use

- Image size is a priority (faster pulls, lower storage costs)
- You don't need glibc-specific features
- Your application is Go, Rust, or another statically-compiled language
- You want a minimal attack surface
- You're comfortable with musl libc

### Alpine Example

```dockerfile
FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata

RUN addgroup -S app && adduser -S app -G app

WORKDIR /app
COPY --chown=app:app server .

USER app
CMD ["./server"]
```

### Why Alpine Is So Small

Alpine uses three key strategies:

1. **musl libc** instead of glibc — musl is smaller and simpler
2. **busybox** for core utilities — one binary provides sh, ls, cat, etc.
3. **Aggressive trimming** — no documentation, no man pages, minimal defaults

```bash
docker images alpine:3.19
```

```
REPOSITORY  TAG   SIZE
alpine      3.19  7.38MB
```

7MB. Compare that to Ubuntu's 77MB.

### The musl libc Gotchas

Here's where Alpine bites you. musl libc is NOT glibc. They're both
implementations of the C standard library, but they differ in important
ways.

**DNS Resolution**

musl handles DNS differently than glibc. The most common issue:
`/etc/nsswitch.conf` isn't used by musl. If your app relies on
nsswitch-based resolution (common with CGO-enabled Go or legacy
libraries), DNS lookups may fail or behave unexpectedly.

Go with `CGO_ENABLED=0` uses its own DNS resolver, so Alpine is fine.
Go with CGO_ENABLED=1 links against the system's libc, and musl's DNS
behavior may surprise you.

**Memory Allocator**

musl's `malloc` implementation is simpler and can be slower for
allocation-heavy workloads. Some applications see measurable performance
differences.

Python and Ruby applications are particularly affected — their runtimes
do heavy memory allocation. Some Python packages won't even compile
against musl without patches.

**Thread Local Storage**

musl handles TLS (Thread Local Storage, not Transport Layer Security)
differently. Some JVM configurations and Oracle client libraries hit
issues.

**Locale Support**

musl has limited locale support. If your application uses locale-dependent
string sorting, number formatting, or date formatting, results may
differ from glibc systems.

### When Alpine Hurts You

Real-world example: a Node.js application on Alpine.

```dockerfile
FROM node:20-alpine
COPY . .
RUN npm ci
```

Some npm packages include native addons compiled with node-gyp. These
compile against the system's libc. On Alpine, that's musl. The compiled
addon might:
- Fail to compile because headers differ
- Compile but crash at runtime due to musl/glibc incompatibilities
- Work fine but behave differently under heavy load

Common problematic packages: `sharp`, `bcrypt`, `grpc`, `sqlite3`.

The fix is usually to install Alpine's build tools:

```dockerfile
FROM node:20-alpine
RUN apk add --no-cache python3 make g++
COPY . .
RUN npm ci
```

But now you've added 150MB of build tools to your 7MB Alpine image. At
that point, you might as well use the regular `node:20` image and do a
multi-stage build.

### The Alpine-Specific Package Ecosystem

Alpine uses `apk` instead of `apt`:

```dockerfile
RUN apk add --no-cache curl wget jq
```

`--no-cache` is Alpine's equivalent of Debian's
`rm -rf /var/lib/apt/lists/*`. It avoids storing the package index.

Alpine's package repository is smaller than Debian/Ubuntu's. Some
packages aren't available, or they're older versions. Check
https://pkgs.alpinelinux.org before committing to Alpine for complex
applications.

---

## Distroless — Google's Minimal Images

### When to Use

- You want minimal images without maintaining your own FROM scratch setup
- You need CA certificates and timezone data (most applications do)
- You don't need a shell in production (you shouldn't)
- You want a predictable, Google-maintained base

### The Distroless Family

| Image | Contents | Use Case |
|-------|----------|----------|
| `distroless/static` | CA certs, tzdata, `/etc/passwd` | Static binaries (Go, Rust) |
| `distroless/base` | static + glibc | Dynamic binaries needing glibc |
| `distroless/cc` | base + libgcc | C/C++ applications |
| `distroless/nodejs20` | base + Node.js 20 runtime | Node.js apps |
| `distroless/python3` | base + Python 3 runtime | Python apps |
| `distroless/java21` | base + Java 21 runtime | Java apps |

### Go with Distroless

```dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /server ./cmd/server

FROM gcr.io/distroless/static-debian12

COPY --from=builder /server /server

USER nonroot:nonroot

EXPOSE 8080
ENTRYPOINT ["/server"]
```

`distroless/static` includes:
- CA certificates (for HTTPS)
- Timezone data (for `time.LoadLocation`)
- `/etc/passwd` with a `nonroot` user
- Nothing else

### Node.js with Distroless

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY dist/ ./dist/

FROM gcr.io/distroless/nodejs20-debian12
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

USER nonroot

EXPOSE 3000
CMD ["dist/server.js"]
```

Notice: no `node` in the CMD. Distroless nodejs images set `node` as
the entrypoint, so you just pass the script path.

### Debugging Distroless

No shell = no `docker exec -it container sh`. This is a feature, not a
bug. In production, you shouldn't be shelling into containers. Use logs,
metrics, and tracing instead.

For development/debugging, use the debug variant:

```dockerfile
FROM gcr.io/distroless/static-debian12:debug
```

```bash
docker run --rm -it gcr.io/distroless/static-debian12:debug sh
```

The debug variant includes busybox. Never use it in production.

### Security Benefits

With no shell, no package manager, and no OS utilities, an attacker who
gains code execution in your application can't:
- Spawn a shell (`/bin/sh` doesn't exist)
- Download tools (`curl`, `wget` don't exist)
- Explore the filesystem (`ls`, `cat` don't exist)
- Install malware (no package manager)

The attack surface is dramatically reduced. Your application binary and
its runtime are the only things that could have vulnerabilities.

---

## Scratch — The Empty Image

### When to Use

- Static binaries that need zero external dependencies
- Go with `CGO_ENABLED=0`
- Rust with static linking
- C with static linking against musl
- Maximum security (literally nothing to exploit)
- Minimum size (your binary IS the image)

### Scratch Example

```dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /server ./cmd/server

FROM scratch
COPY --from=builder /server /server
ENTRYPOINT ["/server"]
```

### What You Must Provide

Scratch gives you NOTHING. You need to bring:

**CA certificates** (if making HTTPS requests):
```dockerfile
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
```

**Timezone data** (if using time zones):
```dockerfile
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo
```

**User database** (if using USER instruction):
```dockerfile
COPY --from=builder /etc/passwd /etc/passwd
```

**DNS configuration** (if not using Go's built-in resolver):
```dockerfile
COPY --from=builder /etc/resolv.conf /etc/resolv.conf
```

### Scratch Limitations

- No shell: can't use `docker exec -it container sh`
- No debugging tools
- No health check using `CMD` (use binary's own health check or
  HTTP-based Docker HEALTHCHECK)
- Can't install additional packages
- Must ensure binary is truly static

### Testing if Your Binary Is Static

```bash
file server
```

```
server: ELF 64-bit LSB executable, x86-64, version 1 (SYSV), statically linked, stripped
```

If it says "dynamically linked", it won't work on scratch. It needs
libc and other shared libraries.

Check dynamic dependencies:

```bash
ldd server
```

```
not a dynamic executable
```

"Not a dynamic executable" means it's static. Good for scratch.

---

## Size Comparisons — Real Numbers

### Go API Server (same binary, different bases)

```bash
docker images --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}"
```

| Image | Size | Binary | Base |
|-------|------|--------|------|
| `myapi:ubuntu` | 92MB | 15MB | ubuntu:22.04 (77MB) |
| `myapi:debian-slim` | 89MB | 15MB | debian:12-slim (74MB) |
| `myapi:alpine` | 22MB | 15MB | alpine:3.19 (7MB) |
| `myapi:distroless` | 17MB | 15MB | distroless/static (2MB) |
| `myapi:scratch` | 15MB | 15MB | scratch (0B) |

The binary is the same in all cases. The only difference is base image
overhead.

### Node.js Express API (same app, different bases)

| Image | Size |
|-------|------|
| `myapp:node-full` | 350MB |
| `myapp:node-slim` | 240MB |
| `myapp:node-alpine` | 178MB |
| `myapp:distroless-node` | 165MB |

Node.js images will always be larger because of the runtime, but the
difference between full and Alpine is still significant.

### Pull Time Impact

On a 100 Mbps connection:

| Image Size | Pull Time |
|-----------|-----------|
| 15MB (scratch) | 1.2s |
| 22MB (alpine) | 1.8s |
| 92MB (ubuntu) | 7.4s |
| 350MB (node full) | 28s |

In a Kubernetes cluster scaling from 5 to 50 pods, those pull times
compound. 50 pods pulling 350MB each is 17.5GB of network traffic vs
750MB for scratch-based images.

---

## Security Considerations

### CVE Counts by Base Image

Vulnerability scanners (Trivy, Snyk, Grype) regularly find
vulnerabilities in base images:

| Base Image | Typical CVE Count | Critical/High |
|-----------|-------------------|---------------|
| `ubuntu:22.04` | 100-300+ | 5-20 |
| `debian:12-slim` | 80-200+ | 3-15 |
| `alpine:3.19` | 10-30 | 0-3 |
| `distroless/static` | 0-5 | 0-1 |
| `scratch` | 0 | 0 |

More packages = more potential vulnerabilities. Scratch has zero OS-level
vulnerabilities because there are zero OS packages.

### Scan Your Images

```bash
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image myapp:latest
```

### The Principle of Least Privilege

Include only what your application needs:
- Don't include a shell if you don't need one
- Don't include a package manager if you won't install packages
- Don't include debugging tools in production
- Don't include build tools in the runtime image

Every utility you include is a potential tool for an attacker.

---

## Decision Matrix

### Use scratch when:

- Your binary is statically linked (Go with CGO_ENABLED=0, Rust with musl)
- You don't need a shell for debugging
- You don't need any OS utilities
- You want absolute minimum size and attack surface
- You're willing to manage CA certs and timezone data yourself

### Use distroless/static when:

- Same as scratch, but you want CA certs and tzdata included automatically
- You want a maintained base that gets security updates
- You want a `nonroot` user out of the box

### Use distroless/base when:

- Your binary needs glibc (CGO_ENABLED=1, or C/C++ with dynamic linking)
- You still want minimal attack surface
- You don't need a shell or package manager

### Use Alpine when:

- You need a shell and package manager but want small images
- Your application works with musl libc
- You need to install additional packages at build time
- Image size matters more than glibc compatibility

### Use Debian slim when:

- You need glibc compatibility
- You need packages from Debian's repository
- You want a balance of size and compatibility
- Your application has native dependencies that require glibc

### Use Ubuntu when:

- Maximum compatibility is the priority
- You're running complex software with many dependencies
- Your team is most familiar with Ubuntu
- You need the largest package repository
- Image size is not a critical concern

---

## Common Patterns for Each Base

### Scratch + Go

```dockerfile
FROM golang:1.22-alpine AS builder
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /server ./cmd/server

FROM scratch
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo
COPY --from=builder /etc/passwd /etc/passwd
COPY --from=builder /server /server
USER 65534
ENTRYPOINT ["/server"]
```

### Alpine + Go (when you need a shell)

```dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /server ./cmd/server

FROM alpine:3.19
RUN apk add --no-cache ca-certificates tzdata
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder /server /server
USER app
ENTRYPOINT ["/server"]
```

### Distroless + Node.js

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY dist/ ./dist/

FROM gcr.io/distroless/nodejs20-debian12
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
USER nonroot
CMD ["dist/server.js"]
```

### Alpine + Node.js (when you need npm scripts at runtime)

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci
COPY src/ ./src/
RUN npm run build
RUN npm prune --production

FROM node:20-alpine
RUN apk add --no-cache tini
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/dist ./dist
COPY --chown=app:app package.json ./
USER app
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server.js"]
```

---

## Exercises

### Exercise 1: Size Olympics

Build the same Go program with five different base images and compare:

```bash
docker build --target scratch-final -t go:scratch .
docker build --target distroless-final -t go:distroless .
docker build --target alpine-final -t go:alpine .
docker build --target debian-final -t go:debian .
docker build --target ubuntu-final -t go:ubuntu .

docker images --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}" | grep "go:"
```

Create a single multi-stage Dockerfile with all five final stages.

### Exercise 2: Vulnerability Scanning

Install Trivy and scan each base image:

```bash
docker run --rm aquasec/trivy image alpine:3.19
docker run --rm aquasec/trivy image ubuntu:22.04
docker run --rm aquasec/trivy image gcr.io/distroless/static-debian12
```

Compare CVE counts. Notice how vulnerability count correlates with
image size and package count.

### Exercise 3: musl vs glibc

Create a Go program that uses CGO:

```go
package main

/*
#include <stdio.h>
void hello() {
    printf("Hello from C\n");
}
*/
import "C"

func main() {
    C.hello()
}
```

Build it on Alpine (musl) and Debian (glibc):

```bash
docker run --rm -v $(pwd):/app -w /app golang:1.22-alpine \
  go build -o hello-musl .

docker run --rm -v $(pwd):/app -w /app golang:1.22 \
  go build -o hello-glibc .
```

Check the binaries:

```bash
docker run --rm -v $(pwd):/app alpine file /app/hello-musl
docker run --rm -v $(pwd):/app debian file /app/hello-glibc
```

Try running the musl binary on Debian and the glibc binary on Alpine.
What happens?

### Exercise 4: Distroless Debugging

Run a distroless container and try to debug it:

```bash
docker run -d --name distroless-app gcr.io/distroless/static-debian12 sleep 3600
docker exec -it distroless-app sh
```

This fails. Now try with the debug variant:

```bash
docker run -d --name distroless-debug gcr.io/distroless/static-debian12:debug sleep 3600
docker exec -it distroless-debug sh
```

Explore what's available in the debug image vs what's missing in the
regular image.

Clean up: `docker rm -f distroless-app distroless-debug`

### Exercise 5: Node.js Alpine Compatibility

Create a Node.js project that uses `sharp` (image processing) or
`bcrypt` (native addon):

```bash
mkdir /tmp/alpine-test && cd /tmp/alpine-test
npm init -y
npm install sharp
```

Try to build on Alpine:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
```

It might fail due to missing native build dependencies. Fix it:

```dockerfile
FROM node:20-alpine
RUN apk add --no-cache python3 make g++ vips-dev
WORKDIR /app
COPY package*.json ./
RUN npm ci
```

Compare the image size with and without the build dependencies. This is
why multi-stage builds matter for Node.js on Alpine.

Clean up: `rm -rf /tmp/alpine-test`

---

## What Would Happen If...

**Q: You use Alpine but your app makes DNS queries with CGO enabled?**

DNS resolution might fail or behave unexpectedly. musl uses a different
DNS resolution path than glibc. Go with `CGO_ENABLED=1` delegates DNS
to the system libc. On Alpine, that's musl, which doesn't read
`/etc/nsswitch.conf` and handles search domains differently.

Fix: use `CGO_ENABLED=0` (Go uses its own DNS resolver) or switch to
Debian-based images.

**Q: You use scratch but forget CA certificates?**

Any HTTPS request fails with `x509: certificate signed by unknown
authority`. Your app can't talk to APIs, databases with TLS, or anything
over HTTPS.

**Q: You use Ubuntu but never update packages?**

You ship known vulnerabilities. The base image's packages are frozen at
the time the image was built. Run `apt-get update && apt-get upgrade` in
your Dockerfile, or use newer base image tags regularly.

**Q: You use distroless but need to run a shell script at startup?**

You can't. There's no shell. Options:
1. Rewrite the script logic in your application
2. Use an init binary (tini) that your application bundles
3. Use Alpine or Debian instead

**Q: Your Alpine-based image works in development but fails in production?**

Common causes:
- DNS resolution differences (musl vs glibc)
- Missing locale support (musl has limited locales)
- Native addon incompatibilities
- Memory allocator performance differences under load

**Q: You pin to `alpine:latest` and your builds break randomly?**

`latest` is a moving target. When Alpine releases a new version, your
image changes. Package versions change, musl version changes, everything
shifts. Pin to a specific version: `alpine:3.19.1`.

---

## Key Takeaways

1. Base image choice is a trade-off between size, compatibility, security,
   and convenience. There's no universally "best" choice.

2. For Go services: use `scratch` or `distroless/static`. Go's static
   binaries need almost nothing from the OS.

3. For Node.js services: use `node:*-alpine` with multi-stage builds, or
   `distroless/nodejs*` if you don't need npm at runtime.

4. Alpine's musl libc is the most common source of subtle bugs. If you
   hit weird DNS, locale, or native addon issues, try switching to a
   glibc-based image.

5. Smaller images = faster pulls, less storage, fewer vulnerabilities.
   But smaller doesn't help if your app doesn't work.

6. Always pin base image versions. `FROM node:20.11.0-alpine3.19` is
   reproducible. `FROM node:latest` is not.

7. Scan your images for vulnerabilities. The base image is your
   responsibility.
