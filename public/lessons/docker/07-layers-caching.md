# Lesson 07: Image Layers and Build Cache

---

## The Chef's Mise en Place Analogy

A professional chef prepares ingredients in stages. Chop the onions.
Dice the tomatoes. Prepare the spice blend. Reduce the stock. Make the
sauce. Plate the dish.

If the chef made this dish yesterday and today's recipe only changes the
sauce, they don't re-chop the onions. The onions are already prepped.
They start from where the recipe diverges and redo only the sauce and
everything after it.

Docker's build cache works the same way. Each instruction in a Dockerfile
is a preparation step. Docker remembers the result of each step. If you
change something at step 5, Docker reuses steps 1-4 from cache and only
rebuilds from step 5 onward.

The difference between a 30-second build and a 5-minute build is
understanding this caching behavior.

---

## How Layers Work

### Every Filesystem-Modifying Instruction Creates a Layer

```dockerfile
FROM ubuntu:22.04          # Layer 1: base image
RUN apt-get update         # Layer 2: package index
RUN apt-get install -y vim # Layer 3: vim binary + deps
COPY app.js /app/          # Layer 4: your application
RUN chmod +x /app/app.js   # Layer 5: permission change
```

Each layer is a diff — it contains only the files that changed in that
step. Layer 3 doesn't contain all of Ubuntu + the package index + vim.
It contains only the new files that `apt-get install vim` added.

### Metadata-Only Instructions Don't Create Filesystem Layers

```dockerfile
ENV NODE_ENV=production    # No filesystem layer (metadata only)
EXPOSE 3000                # No filesystem layer (metadata only)
CMD ["node", "server.js"]  # No filesystem layer (metadata only)
LABEL version="1.0"        # No filesystem layer (metadata only)
WORKDIR /app               # Creates directory if needed (tiny layer)
```

These add metadata to the image configuration but don't change
filesystem contents (except WORKDIR, which may create a directory).

### Viewing Layers

```bash
docker build -t layer-demo .
docker history layer-demo
```

```
IMAGE         CREATED       CREATED BY                                SIZE
a1b2c3d4e5f6  2 seconds ago CMD ["node" "server.js"]                  0B
<missing>     2 seconds ago EXPOSE map[3000/tcp:{}]                   0B
<missing>     3 seconds ago COPY . . # buildkit                      2.4kB
<missing>     3 seconds ago RUN npm ci # buildkit                    45.2MB
<missing>     4 seconds ago COPY package*.json ./ # buildkit         1.2kB
<missing>     4 seconds ago WORKDIR /app                              0B
<missing>     2 weeks ago   /bin/sh -c #(nop) CMD ["node"]            0B
<missing>     2 weeks ago   ...                                       ...
```

The SIZE column shows each layer's contribution. 0B means no filesystem
change.

---

## Cache Rules — When Docker Reuses a Layer

Docker evaluates each instruction during a build. For each instruction,
it asks: "Have I seen this exact instruction before with the same context?"

### Rule 1: If the Instruction Text Changes, Cache Misses

```dockerfile
RUN apt-get update && apt-get install -y curl
```

vs

```dockerfile
RUN apt-get update && apt-get install -y curl wget
```

Different instruction text = different layer. Cache busted for this
instruction and everything after it.

### Rule 2: For COPY/ADD, Docker Checks File Contents

```dockerfile
COPY package.json ./
```

Docker computes a checksum of `package.json` in the build context. If
the checksum matches the cached version, the cache is hit. If any byte
in the file changed, cache misses.

This is why the order of COPY instructions is so critical:

```dockerfile
COPY package.json package-lock.json ./    # Cache hit if deps unchanged
RUN npm ci                                 # Cache hit (same deps)
COPY . .                                   # Cache miss if ANY file changed
```

### Rule 3: A Cache Miss Invalidates ALL Subsequent Layers

This is the domino effect. If step 3 cache misses, steps 4, 5, 6, etc.
are all rebuilt — even if their instructions and inputs haven't changed.

```
Step 1: FROM node:20-alpine         ✓ cached
Step 2: WORKDIR /app                ✓ cached
Step 3: COPY package.json ./        ✓ cached (file unchanged)
Step 4: RUN npm ci                  ✓ cached (same instruction, same input)
Step 5: COPY . .                    ✗ MISS (source code changed)
Step 6: RUN npm run build           ✗ rebuilt (after miss)
Step 7: CMD ["node", "dist/app.js"] ✗ rebuilt (after miss)
```

### Rule 4: RUN Caching Depends on the Instruction String Only

```dockerfile
RUN apt-get update
```

Docker caches this based on the instruction text, NOT on what `apt-get
update` would return today. If you ran this a week ago, Docker reuses
the week-old package index.

This is why you should combine update and install:

```dockerfile
RUN apt-get update && apt-get install -y curl
```

If you need fresh packages, bust the cache:

```bash
docker build --no-cache -t myapp .
```

### Rule 5: ARG Values Affect Cache

```dockerfile
ARG VERSION=1.0
RUN echo $VERSION > /version.txt
```

Building with `--build-arg VERSION=2.0` causes a cache miss because the
ARG value changed, which changes the effective instruction.

---

## Why COPY go.mod Before COPY . Matters

### The Bad Way

```dockerfile
FROM golang:1.22-alpine
WORKDIR /app
COPY . .
RUN go mod download
RUN go build -o server ./cmd/server
```

Timeline:
1. You change one line in `main.go`
2. `COPY . .` cache misses (source files changed)
3. `go mod download` rebuilds (45 seconds downloading ALL dependencies)
4. `go build` rebuilds (expected)

Every code change triggers a full dependency download.

### The Good Way

```dockerfile
FROM golang:1.22-alpine
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o server ./cmd/server
```

Timeline:
1. You change one line in `main.go`
2. `COPY go.mod go.sum ./` cache hits (dependency files unchanged)
3. `go mod download` cache hits (same deps, reused from cache)
4. `COPY . .` cache misses (source files changed)
5. `go build` rebuilds (expected, but deps already cached)

Build time drops from 60 seconds to 15 seconds.

### Measuring the Difference

Build both versions and compare:

```bash
time docker build -t bad-cache -f Dockerfile.bad .
time docker build -t good-cache -f Dockerfile.good .
```

Change one `.go` file and rebuild:

```bash
time docker build -t bad-cache -f Dockerfile.bad .
time docker build -t good-cache -f Dockerfile.good .
```

The second build with good caching will be dramatically faster.

---

## Why COPY package.json Before COPY . Matters

Same principle for Node.js:

### The Bad Way

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build
```

Any file change triggers `npm ci` (30-60 seconds for a typical project).

### The Good Way

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
```

Dependency installation only runs when `package.json` or
`package-lock.json` changes. Code changes skip straight to the `COPY . .`
step.

### The Even Better Way

Separate production and development dependencies:

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

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
CMD ["node", "dist/server.js"]
```

The `deps` stage produces minimal production `node_modules`. The
`builder` stage compiles TypeScript. The final image has neither dev
dependencies nor TypeScript source.

---

## Cache Busters and When to Use Them

Sometimes you WANT to bypass the cache:

### Full Cache Bust

```bash
docker build --no-cache -t myapp .
```

Rebuilds everything. Use when you suspect stale cached layers (e.g.,
`apt-get update` using a week-old index).

### Targeted Cache Bust with ARG

```dockerfile
ARG CACHE_BUST=1
RUN apt-get update && apt-get install -y curl
```

```bash
docker build --build-arg CACHE_BUST=$(date +%s) -t myapp .
```

Changing `CACHE_BUST` invalidates only that layer and everything after
it.

### Targeted Cache Bust with File Changes

Adding a timestamp file forces a cache miss at a specific point:

```dockerfile
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
```

If you touch `package.json` (even without changing its contents), the
checksum changes and the cache misses. Use `--no-cache` instead — it's
more explicit.

---

## BuildKit — The Modern Build Engine

BuildKit is Docker's next-generation build engine. It's enabled by
default in Docker Desktop and recent Docker Engine versions.

### Enable BuildKit

```bash
DOCKER_BUILDKIT=1 docker build -t myapp .
```

Or permanently in `/etc/docker/daemon.json`:

```json
{
  "features": {
    "buildkit": true
  }
}
```

### BuildKit Improvements

**Parallel Stage Execution:**
In multi-stage builds, BuildKit runs independent stages in parallel:

```dockerfile
FROM golang:1.22-alpine AS go-builder
COPY . .
RUN go build -o /server ./cmd/server

FROM node:20-alpine AS node-builder
COPY frontend/ .
RUN npm ci && npm run build

FROM scratch
COPY --from=go-builder /server /server
COPY --from=node-builder /app/dist /static
```

BuildKit builds `go-builder` and `node-builder` simultaneously because
they're independent. The legacy builder runs them sequentially.

**Better Caching:**
BuildKit uses content-addressable caching instead of ordered layer
caching. It can detect that a layer's output would be identical even if
the instruction index changed.

**Build Secrets:**

```dockerfile
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm ci
```

```bash
docker build --secret id=npmrc,src=$HOME/.npmrc -t myapp .
```

The secret is available during the build but never stored in any layer.
Invisible in `docker history`.

**SSH Forwarding:**

```dockerfile
RUN --mount=type=ssh git clone git@github.com:private/repo.git
```

```bash
docker build --ssh default -t myapp .
```

Your SSH agent is forwarded to the build without putting keys in the
image.

**Cache Mounts:**

```dockerfile
RUN --mount=type=cache,target=/root/.cache/go-build \
    --mount=type=cache,target=/go/pkg/mod \
    go build -o /server ./cmd/server
```

The Go build cache and module cache persist between builds, even across
different images. Massive speedup for Go builds.

For Node.js:

```dockerfile
RUN --mount=type=cache,target=/root/.npm \
    npm ci
```

**Inline Progress:**

```bash
docker build --progress=plain -t myapp .
```

Shows full build output instead of collapsed progress bars. Essential for
debugging build issues.

---

## Advanced Caching Strategies

### External Cache Sources

Cache from a registry:

```bash
docker buildx build \
  --cache-from type=registry,ref=registry.example.com/myapp:cache \
  --cache-to type=registry,ref=registry.example.com/myapp:cache \
  -t myapp .
```

CI/CD pipelines can push and pull cache layers from a registry. The first
build on a new CI runner pulls cached layers instead of building from
scratch.

### Local Cache Directory

```bash
docker buildx build \
  --cache-from type=local,src=/tmp/docker-cache \
  --cache-to type=local,dest=/tmp/docker-cache \
  -t myapp .
```

Useful for local development — the cache persists across builds even if
you `docker system prune`.

### GitHub Actions Cache

```yaml
- name: Build image
  uses: docker/build-push-action@v5
  with:
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

Uses GitHub Actions' built-in cache, shared across workflow runs.

---

## Layer Size Optimization

### The Delete-Doesn't-Help Problem

```dockerfile
RUN curl -O https://example.com/big-tool-500MB.tar.gz
RUN tar xzf big-tool-500MB.tar.gz
RUN ./big-tool --process-stuff
RUN rm big-tool-500MB.tar.gz
```

Image size: ~500MB from the tool, even though it's "deleted."

Layer 1 adds 500MB. Layer 4 adds a whiteout file that hides it. But the
500MB still exists in layer 1 and is part of the image.

**Fix:** Single layer:

```dockerfile
RUN curl -O https://example.com/big-tool-500MB.tar.gz && \
    tar xzf big-tool-500MB.tar.gz && \
    ./big-tool --process-stuff && \
    rm big-tool-500MB.tar.gz
```

The file is created and deleted in the same layer. It never appears in
the final layer diff.

### Minimizing apt/apk Layers

```dockerfile
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      curl \
      ca-certificates && \
    rm -rf /var/lib/apt/lists/*
```

`--no-install-recommends` avoids pulling in suggested packages.
`rm -rf /var/lib/apt/lists/*` removes the package index.

### Analyzing Image Size

```bash
docker images myapp
```

For detailed layer analysis:

```bash
docker history --no-trunc myapp:latest
```

For interactive analysis, use `dive`:

```bash
docker run --rm -it \
  -v /var/run/docker.sock:/var/run/docker.sock \
  wagoodman/dive myapp:latest
```

`dive` shows:
- Each layer's contents
- Files added, modified, deleted
- Wasted space (files added then deleted in later layers)
- Overall efficiency score

---

## Build Time Comparison: With and Without Cache

### Scenario: Go API, First Build

```
Step 1/7 : FROM golang:1.22-alpine          0.1s  (pull if needed)
Step 2/7 : WORKDIR /app                     0.0s
Step 3/7 : COPY go.mod go.sum ./            0.1s
Step 4/7 : RUN go mod download              42.3s ← downloads all deps
Step 5/7 : COPY . .                         0.2s
Step 6/7 : RUN go build -o /server          18.7s ← compiles everything
Step 7/7 : CMD ["/server"]                  0.0s
                                    Total:  61.4s
```

### Scenario: Go API, Code Change Only (Cached)

```
Step 1/7 : FROM golang:1.22-alpine          CACHED
Step 2/7 : WORKDIR /app                     CACHED
Step 3/7 : COPY go.mod go.sum ./            CACHED ← deps unchanged
Step 4/7 : RUN go mod download              CACHED ← reused!
Step 5/7 : COPY . .                         0.2s   ← code changed
Step 6/7 : RUN go build -o /server          18.7s  ← recompiles
Step 7/7 : CMD ["/server"]                  0.0s
                                    Total:  19.1s
```

42 seconds saved by not re-downloading dependencies.

### Scenario: Go API, With BuildKit Cache Mount

```dockerfile
RUN --mount=type=cache,target=/root/.cache/go-build \
    --mount=type=cache,target=/go/pkg/mod \
    go build -o /server ./cmd/server
```

```
Step 6/7 : RUN go build -o /server          5.2s ← incremental compile!
                                    Total:   5.6s
```

The Go build cache persists between builds. Incremental compilation
only recompiles changed packages. 61 seconds → 5 seconds.

### Scenario: Node.js, With and Without Cache

**Without cache optimization:**
```
COPY . .                                    0.5s
RUN npm ci                                 34.2s ← every build
RUN npm run build                          12.8s
                                   Total:  47.5s
```

**With cache optimization:**
```
COPY package.json package-lock.json ./      CACHED
RUN npm ci                                  CACHED ← deps unchanged
COPY . .                                    0.5s
RUN npm run build                          12.8s
                                   Total:  13.3s
```

34 seconds saved.

---

## Exercises

### Exercise 1: Measure Cache Impact

Create a simple Node.js app and two Dockerfiles:

**Dockerfile.bad:**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build
CMD ["node", "dist/server.js"]
```

**Dockerfile.good:**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
CMD ["node", "dist/server.js"]
```

Build both. Change one source file. Rebuild both. Time each build.

```bash
time docker build -t bad -f Dockerfile.bad .
time docker build -t good -f Dockerfile.good .

echo "// changed" >> src/server.ts

time docker build -t bad -f Dockerfile.bad .
time docker build -t good -f Dockerfile.good .
```

### Exercise 2: Layer Archaeology

Build an image and investigate its layers:

```bash
docker build -t layer-arch .
docker history layer-arch
docker history --no-trunc layer-arch
docker inspect layer-arch | jq '.[0].RootFS.Layers'
```

Questions:
1. How many layers does your image have?
2. Which layer is the largest?
3. Which layers are 0B?
4. Are there any layers that could be combined?

### Exercise 3: Find Wasted Space

Build this intentionally wasteful Dockerfile:

```dockerfile
FROM ubuntu:22.04
RUN apt-get update
RUN apt-get install -y gcc make
RUN echo "int main() { return 0; }" > /tmp/test.c
RUN gcc -o /tmp/test /tmp/test.c
RUN rm -rf /tmp/test.c
RUN apt-get remove -y gcc make
RUN apt-get autoremove -y
```

Check the image size. Is it small because gcc was removed? Run `dive`
or `docker history` to find the wasted space.

Now fix it with a single-layer approach or multi-stage build.

### Exercise 4: BuildKit Cache Mounts

If you have a Go project, compare build times with and without cache
mounts:

```dockerfile
FROM golang:1.22-alpine
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o /server ./cmd/server
```

vs

```dockerfile
FROM golang:1.22-alpine
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN --mount=type=cache,target=/root/.cache/go-build \
    go build -o /server ./cmd/server
```

Build, change a file, rebuild. The cache mount version should be
significantly faster on the second build.

### Exercise 5: Cache Invalidation Detective

Build this Dockerfile twice:

```dockerfile
FROM alpine:3.19
ARG BUILD_TIME=unknown
RUN echo "Build started at $BUILD_TIME" > /build-info.txt
COPY config/ /app/config/
COPY src/ /app/src/
RUN cat /app/config/*.json
CMD ["cat", "/build-info.txt"]
```

```bash
docker build --build-arg BUILD_TIME=$(date) -t cache-detective .
docker build --build-arg BUILD_TIME=$(date) -t cache-detective .
```

Questions:
1. Does the second build use any cached layers?
2. Why or why not?
3. How would you restructure this to maximize caching?

---

## What Would Happen If...

**Q: You change the order of two independent RUN instructions?**

Cache misses for both and everything after. Docker matches cache by
instruction order AND content. Swapping the order of two instructions
means both are "new" from Docker's perspective.

**Q: You add an ENV instruction between two RUN instructions?**

The ENV itself is cached (no filesystem change). But the RUN after it
might miss cache if the ENV value changes the effective instruction.

**Q: You use `docker build --no-cache` but nothing changed?**

Everything rebuilds from scratch. All layers are regenerated. Useful when
you suspect stale apt indices or need a completely fresh build.

**Q: Two different Dockerfiles produce identical layers?**

Docker's content-addressable storage deduplicates them. If layer X has
the same content hash regardless of which Dockerfile produced it, it's
stored once.

**Q: You push an image, delete it locally, and pull it back?**

Layers that already exist locally (from other images) aren't
re-downloaded. Docker checks by content hash.

**Q: Your CI builds take 15 minutes but local builds take 2 minutes?**

CI runners often start with empty Docker caches. Each build downloads
base images and rebuilds all layers. Solutions: use registry-based
cache, pre-warm CI runners, or use GitHub Actions cache.

---

## Key Takeaways

1. Each Dockerfile instruction creates a layer. Docker caches each layer
   and reuses it if the instruction and its inputs are unchanged.

2. Cache invalidation is a cascade: one missed layer invalidates ALL
   subsequent layers. Put stable instructions first, volatile ones last.

3. Separate dependency files (go.mod, package.json) from source code in
   COPY instructions. This preserves the expensive dependency-install
   cache when only code changes.

4. Files deleted in a later layer still exist in earlier layers. Combine
   create-and-delete in single RUN instructions, or use multi-stage
   builds.

5. BuildKit adds parallel builds, cache mounts, secrets, and external
   cache sources. It's strictly superior to the legacy builder.

6. Measure your build times. A well-optimized Dockerfile can be 10x
   faster than a naive one.

---

## Next Lesson

You've seen multi-stage builds referenced throughout this lesson. Lesson
08 does a complete deep dive into **multi-stage builds** — the pattern
that lets you build in a feature-rich environment and ship only the
minimal result.
