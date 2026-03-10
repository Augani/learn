# Docker in CI/CD

## Why Docker in CI/CD Matters

Without Docker in CI/CD, your pipeline builds code on a CI runner and hopes the production environment matches. With Docker, you build an image in CI that IS the production artifact. The thing you test is the thing you deploy.

Think of it like shipping furniture: without Docker, you ship the raw materials and assembly instructions, hoping the customer has the right tools. With Docker, you ship the fully assembled furniture in a protective box.

---

## Building Images in GitHub Actions

### Basic Build and Push

```yaml
name: Build and Push

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Docker Hub
        if: github.event_name != 'pull_request'
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: .
          push: ${{ github.event_name != 'pull_request' }}
          tags: myorg/myapp:latest
```

On pull requests: build only (verify it compiles). On main: build AND push to the registry.

### GitHub Container Registry (ghcr.io)

```yaml
      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ghcr.io/${{ github.repository }}:latest
```

`GITHUB_TOKEN` is provided automatically — no manual secret setup needed.

### AWS ECR

```yaml
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Log in to Amazon ECR
        id: ecr-login
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ${{ steps.ecr-login.outputs.registry }}/myapp:latest
```

---

## Tagging Strategies

Tags identify specific versions of your image. A good tagging strategy makes deployments traceable and rollbacks easy.

### Semantic Versioning

```yaml
      - name: Extract version from tag
        if: startsWith(github.ref, 'refs/tags/v')
        id: version
        run: echo "VERSION=${GITHUB_REF#refs/tags/v}" >> $GITHUB_OUTPUT

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: |
            myorg/myapp:${{ steps.version.outputs.VERSION }}
            myorg/myapp:latest
```

Tag `v1.5.0` produces images tagged `1.5.0` AND `latest`.

### Git SHA Tags

Every commit gets a unique, immutable tag:

```yaml
      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: |
            myorg/myapp:${{ github.sha }}
            myorg/myapp:sha-${{ github.sha }}
```

Git SHA tags are perfect for traceability. You can always map a running container back to the exact commit:

```bash
docker inspect myapp | grep -i sha
```

### Comprehensive Tagging with Metadata Action

```yaml
      - name: Docker metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: |
            myorg/myapp
            ghcr.io/${{ github.repository }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=semver,pattern={{major}}
            type=sha,prefix=sha-
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: .
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
```

This produces tags like:
- `v1.5.0` -> `1.5.0`, `1.5`, `1`, `latest`, `sha-abc123`
- `main` branch -> `main`, `latest`, `sha-abc123`
- PR #42 -> `pr-42` (not pushed)

### Tagging Anti-Patterns

```yaml
# BAD: "latest" alone — which version is this?
tags: myorg/myapp:latest

# BAD: only branch name — can't trace to a commit
tags: myorg/myapp:main

# GOOD: SHA + semver + latest
tags: |
  myorg/myapp:1.5.0
  myorg/myapp:sha-abc123def
  myorg/myapp:latest
```

Never deploy `latest` to production. Always use a specific version or SHA tag. `latest` changes silently and makes rollbacks impossible.

---

## Caching Strategies

Docker builds in CI are slow without caching. Every layer rebuild costs time and money.

### GitHub Actions Cache

```yaml
      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: myorg/myapp:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

`type=gha` uses GitHub Actions' built-in cache. `mode=max` caches all layers, not just the final image layers. This is the easiest and most effective caching for GitHub Actions.

### Registry Cache

Use your container registry as a cache backend:

```yaml
      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: myorg/myapp:latest
          cache-from: type=registry,ref=myorg/myapp:buildcache
          cache-to: type=registry,ref=myorg/myapp:buildcache,mode=max
```

This stores cache layers in the registry alongside your images. Useful when you want cache shared across different CI providers.

### --cache-from with Previous Image

Pull the last built image and use its layers as cache:

```yaml
      - name: Pull previous image for cache
        run: docker pull myorg/myapp:latest || true

      - name: Build
        uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: myorg/myapp:latest
          cache-from: type=registry,ref=myorg/myapp:latest
```

### BuildKit Cache Mounts

For package manager caches (npm, Go modules, pip), use BuildKit cache mounts in your Dockerfile:

```dockerfile
# syntax=docker/dockerfile:1
FROM golang:1.22-alpine AS builder
WORKDIR /app

COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

COPY . .
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -o /server .
```

For Node.js:

```dockerfile
# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

COPY . .
RUN npm run build
```

Cache mounts persist across builds. Go module downloads and npm installs skip packages already in the cache. This cuts build times dramatically.

### Caching Impact

| Strategy | First build | Subsequent builds | Shared across branches? |
|----------|------------|-------------------|----------------------|
| No cache | 5 min | 5 min | N/A |
| GHA cache | 5 min | 1-2 min | Yes |
| Registry cache | 5 min | 1-2 min | Yes |
| Cache mounts | 5 min | 30s-1 min | Depends on CI |

---

## Multi-Platform Builds

Build images that run on both AMD64 (Intel/AMD) and ARM64 (Apple Silicon, AWS Graviton).

```yaml
      - name: Set up QEMU
        uses: docker/setup-qemu-action@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build and push multi-platform
        uses: docker/build-push-action@v6
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: true
          tags: myorg/myapp:latest
```

QEMU emulates ARM on AMD (and vice versa) during the build. Buildx manages building for each platform and creating a manifest list.

When someone pulls `myorg/myapp:latest`, Docker automatically selects the right architecture.

### Platform-Specific Build Steps

Some dependencies differ by architecture:

```dockerfile
FROM --platform=$BUILDPLATFORM golang:1.22-alpine AS builder
ARG TARGETPLATFORM
ARG TARGETOS
ARG TARGETARCH

WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -o /server .

FROM alpine:3.19
COPY --from=builder /server /server
ENTRYPOINT ["/server"]
```

`$BUILDPLATFORM` is the CI runner's architecture. `$TARGETPLATFORM` is the target. Go cross-compiles natively, so the build runs at full speed on the CI runner regardless of target platform.

---

## Automated Security Scanning in CI

### Trivy Scan

```yaml
      - name: Build image
        uses: docker/build-push-action@v6
        with:
          context: .
          load: true
          tags: myapp:test

      - name: Scan for vulnerabilities
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: myapp:test
          format: table
          exit-code: 1
          severity: CRITICAL,HIGH

      - name: Push if scan passes
        if: success()
        uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: myorg/myapp:latest
```

The `exit-code: 1` fails the workflow if critical or high vulnerabilities are found. The image is only pushed if scanning passes.

### Docker Scout in CI

```yaml
      - name: Docker Scout scan
        uses: docker/scout-action@v1
        with:
          command: cves
          image: myapp:test
          only-severities: critical,high
          exit-code: true
```

### Scan Results as PR Comments

```yaml
      - name: Trivy scan (SARIF)
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: myapp:test
          format: sarif
          output: trivy-results.sarif

      - name: Upload scan results
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: trivy-results.sarif
```

This uploads scan results to GitHub's Security tab, where they appear alongside code scanning alerts.

---

## Complete CI/CD Workflow

Here's a production-ready workflow for a Go application:

```yaml
name: CI/CD

on:
  push:
    branches: [main]
    tags: ["v*"]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-go@v5
        with:
          go-version: "1.22"

      - name: Run tests
        run: go test -race -coverprofile=coverage.out ./...

      - name: Run linter
        uses: golangci/golangci-lint-action@v4
        with:
          version: latest

  build:
    needs: test
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
      security-events: write

    steps:
      - uses: actions/checkout@v4

      - name: Set up QEMU
        uses: docker/setup-qemu-action@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GHCR
        if: github.event_name != 'pull_request'
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha,prefix=sha-
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build image for testing
        uses: docker/build-push-action@v6
        with:
          context: .
          load: true
          tags: ${{ env.IMAGE_NAME }}:test
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Scan for vulnerabilities
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ env.IMAGE_NAME }}:test
          format: sarif
          output: trivy-results.sarif
          severity: CRITICAL,HIGH

      - name: Upload scan results
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: trivy-results.sarif

      - name: Fail on critical vulnerabilities
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ env.IMAGE_NAME }}:test
          format: table
          exit-code: 1
          severity: CRITICAL

      - name: Build and push
        if: github.event_name != 'pull_request'
        uses: docker/build-push-action@v6
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### Workflow for a Node.js/TypeScript Application

```yaml
name: CI/CD

on:
  push:
    branches: [main]
    tags: ["v*"]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test -- --coverage

  build:
    needs: test
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
      security-events: write

    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GHCR
        if: github.event_name != 'pull_request'
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha,prefix=sha-
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build for testing
        uses: docker/build-push-action@v6
        with:
          context: .
          load: true
          tags: ${{ env.IMAGE_NAME }}:test
          cache-from: type=gha
          cache-to: type=gha,mode=max
          secrets: |
            npmrc=${{ secrets.NPM_TOKEN }}

      - name: Scan for vulnerabilities
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ env.IMAGE_NAME }}:test
          exit-code: 1
          severity: CRITICAL

      - name: Build and push
        if: github.event_name != 'pull_request'
        uses: docker/build-push-action@v6
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### The Dockerfile for This Pipeline

```dockerfile
# syntax=docker/dockerfile:1
FROM golang:1.22-alpine AS builder
WORKDIR /app

COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

COPY . .
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -ldflags="-s -w" -o /server .

FROM gcr.io/distroless/static-debian12
COPY --from=builder /server /server
USER nonroot
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD ["/server", "-healthcheck"]
ENTRYPOINT ["/server"]
```

---

## Exercises

### Exercise 1: Basic CI Pipeline

Create a GitHub repository with a Go or Node.js application. Set up a GitHub Actions workflow that:
1. Runs tests
2. Builds a Docker image
3. Scans for vulnerabilities
4. Pushes to GitHub Container Registry

### Exercise 2: Caching Optimization

Take the workflow from Exercise 1 and:
1. Measure the build time without caching
2. Add GHA cache and measure the improvement
3. Add BuildKit cache mounts to the Dockerfile and measure again
4. Document the time savings

### Exercise 3: Multi-Platform Build

Extend your workflow to build for both `linux/amd64` and `linux/arm64`. Pull the image on a Mac with Apple Silicon (or use `docker run --platform linux/arm64`) and verify it runs.

### Exercise 4: Tagging Strategy

Implement a tagging strategy where:
- Every push to `main` produces `latest` and `sha-<hash>` tags
- Git tags like `v1.2.3` produce `1.2.3`, `1.2`, and `1` tags
- Pull requests produce `pr-<number>` tags (not pushed)

Verify by creating a tag and checking the registry.

### Exercise 5: Security Gate

Configure your pipeline so that:
1. Critical vulnerabilities block the build
2. High vulnerabilities produce a warning but don't block
3. Scan results appear in the GitHub Security tab
4. A PR comment summarizes the scan findings

---

## What Would Happen If...

**...you pushed images without any security scanning?**

You might deploy a container with a known remote code execution vulnerability. Attackers scan public registries for vulnerable images. Automated scanning in CI catches these before deployment — it's your first line of defense.

**...you only used the `latest` tag in production?**

You can't tell which version is running. Rollbacks require finding the previous image by creation date. Two deploys minutes apart might use different images. Always deploy with specific SHA or semver tags.

**...your CI cache was poisoned?**

If someone modifies cached layers maliciously (rare but possible), every build using that cache is compromised. Periodically run builds with `--no-cache` to verify. Use immutable cache keys tied to lockfile hashes.

**...you forgot to set up multi-platform builds and your prod runs on ARM?**

The image fails to start with an exec format error. The binary compiled for AMD64 can't run on ARM64. This is increasingly common with AWS Graviton instances and Apple Silicon development machines.

**...your Docker Hub credentials expired in CI?**

Builds that depend on pulling base images from Docker Hub might get rate-limited (100 pulls/6 hours for anonymous, 200 for free accounts). Use GitHub Container Registry or a registry mirror to avoid rate limits.

---

## Key Takeaways

1. Build and test the SAME image you deploy — no "it works in CI" surprises
2. Use GitHub Actions cache (`type=gha`) for the easiest caching setup
3. Add BuildKit cache mounts for package managers (Go modules, npm, pip)
4. Tag with semver AND git SHA — never deploy `latest` to production
5. Scan every image in CI — block on critical, warn on high
6. Build multi-platform (amd64 + arm64) from the start — it's easy with buildx
7. Use `docker/metadata-action` to generate consistent tags automatically
8. Keep secrets out of build args — use BuildKit secret mounts
