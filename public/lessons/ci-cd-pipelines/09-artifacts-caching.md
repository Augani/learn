# Lesson 09: Artifacts & Caching

> **The one thing to remember**: Caching is like a squirrel burying
> nuts. Instead of gathering nuts from scratch every winter (downloading
> dependencies every build), the squirrel digs up the nuts it already
> gathered (restores from cache). Artifacts are the finished product —
> the acorn butter the squirrel made and wants to share with others.

---

## The Workshop Analogy

Imagine a woodworker's shop:

```
WITHOUT CACHING (every project)         WITH CACHING

  1. Drive to lumber yard (30 min)       1. Grab lumber from shed (1 min)
  2. Buy exact same wood (15 min)           (same wood from last time)
  3. Drive back (30 min)                 2. Start building immediately
  4. Start building (60 min)                (60 min)
  ---                                    ---
  Total: 2 hours 15 min                  Total: 1 hour 1 min

  The shed is the cache.
  The lumber is your dependencies.
```

And artifacts:

```
  The finished chair is the ARTIFACT.
  You built it in the workshop (CI).
  Now you move it to the showroom (deploy).
  The chair doesn't need the workshop tools to sit on.
```

---

## What Gets Cached

```
WHAT TO CACHE IN CI

  What                Where It Lives              Cache Key
  ------------------------------------------------------------------
  npm packages        node_modules/ or ~/.npm      hash of package-lock.json
  pip packages        ~/.cache/pip                 hash of requirements.txt
  cargo crates        ~/.cargo/ + target/          hash of Cargo.lock
  go modules          ~/go/pkg/mod                 hash of go.sum
  gradle deps         ~/.gradle/caches             hash of build.gradle
  build output        dist/, target/, build/        hash of source files
  docker layers       /var/lib/docker               hash of Dockerfile
```

The **cache key** is critical. It determines when the cache is valid:

```
CACHE KEY LOGIC

  Key: linux-npm-abc123def456
       |     |   |
       |     |   └── hash of package-lock.json
       |     └────── tool (npm, cargo, pip)
       └──────────── operating system

  Same key = cache HIT → restore cached files, skip install
  Different key = cache MISS → full install, then save to cache
```

---

## Dependency Caching in GitHub Actions

### Built-in Caching (Simplest)

Most setup actions have built-in caching:

```yaml
# Node.js — cache npm dependencies
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'

# Python — cache pip
- uses: actions/setup-python@v5
  with:
    python-version: '3.12'
    cache: 'pip'

# Rust — use a dedicated cache action
- uses: Swatinem/rust-cache@v2
```

### Manual Caching (More Control)

```yaml
- name: Cache node_modules
  uses: actions/cache@v4
  id: npm-cache
  with:
    path: node_modules
    key: ${{ runner.os }}-node-${{ hashFiles('package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-

- name: Install dependencies
  if: steps.npm-cache.outputs.cache-hit != 'true'
  run: npm ci
```

```
CACHE FLOW

  Step 1: Check cache
       |
       ├── key "linux-node-abc123" found → CACHE HIT
       │   Restore node_modules/
       │   Skip "npm ci" step
       │
       └── key not found → CACHE MISS
           Check restore-keys "linux-node-"
           |
           ├── Partial match found → Restore closest match
           │   Run "npm ci" (faster, partial cache)
           │   Save new cache with exact key
           │
           └── No match → Fresh install
               Run "npm ci" (full, slow)
               Save new cache with exact key
```

### Rust Caching (Compiles Are Expensive)

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: dtolnay/rust-toolchain@stable

      - uses: Swatinem/rust-cache@v2
        with:
          cache-on-failure: true

      - run: cargo build --release
      - run: cargo test
```

```
RUST BUILD TIMES

  Without cache:
  cargo build --release → 8 minutes (compiles all dependencies)

  With cache (deps unchanged):
  cargo build --release → 45 seconds (only compiles your code)

  Speedup: ~10x
```

---

## Cache Limits and Strategy

```
GITHUB ACTIONS CACHE LIMITS

  Total cache per repo:     10 GB
  Individual cache entry:   No hard limit (practical ~2 GB)
  Cache eviction:           LRU (least recently used) when at 10 GB
  Cache lifetime:           7 days without access, then evicted
  Branch access:            Caches from default branch are shared
                            Feature branches can READ default's cache
                            Feature branches can't WRITE to default's cache
```

```
CACHE ACCESS RULES

  main branch cache:
  ├── main can read & write
  ├── feature/login can READ (but not write)
  └── feature/signup can READ (but not write)

  feature/login cache:
  ├── feature/login can read & write
  └── NO other branch can access it

  This means: build your cache on main first.
  Feature branches will benefit automatically.
```

---

## Build Artifacts

Artifacts are files produced by one job and consumed by another (or
downloaded by humans).

### Uploading Artifacts

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run build

      - uses: actions/upload-artifact@v4
        with:
          name: webapp-dist
          path: dist/
          retention-days: 7
          if-no-files-found: error
```

### Downloading Artifacts in Another Job

```yaml
  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: webapp-dist
          path: dist/

      - name: Deploy
        run: |
          ls -la dist/
          ./scripts/deploy.sh dist/
```

```
ARTIFACT FLOW BETWEEN JOBS

  Job: build                         Job: deploy
  +------------------+               +------------------+
  | npm run build    |               | download artifact|
  |   creates dist/  |               |   restores dist/ |
  |                  |               |                  |
  | upload-artifact  |──────────────>| deploy dist/     |
  | name: webapp-dist|  (stored in   |                  |
  +------------------+   GitHub's    +------------------+
                         servers)
```

### Multiple Artifacts

```yaml
      - uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: test-results/

      - uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/

      - uses: actions/upload-artifact@v4
        with:
          name: build-output
          path: dist/
```

---

## Artifacts vs Cache: When to Use Which

```
ARTIFACTS vs CACHE

  Feature          Artifact                    Cache
  ---------------------------------------------------------------
  Purpose          Pass data between jobs      Speed up repeated steps
                   or save build output        by reusing work

  Lifetime         1-90 days (configurable)    7 days (auto-evicted)

  Access           Any job in workflow,         Same repo, same or
                   downloadable by humans      child branches

  Cost             Counts toward storage       Counts toward 10 GB
                   limit (500 MB-50 GB)        cache limit

  Use when         You need the BUILD OUTPUT   You want to SKIP a step
                   (deploy it, download it)    (don't re-download deps)

  Examples         dist/ folder, binaries,     node_modules/,
                   test reports, Docker        ~/.cargo/, ~/.cache/pip
                   images, APK files
```

```
DECISION GUIDE

  "I need to deploy the files I just built"
  → ARTIFACT (pass build output to deploy job)

  "I don't want to download 500 npm packages again"
  → CACHE (reuse node_modules across runs)

  "I want to download test results from CI"
  → ARTIFACT (humans can download from Actions tab)

  "My Rust build takes 10 minutes, most deps haven't changed"
  → CACHE (reuse compiled dependencies)
```

---

## Advanced Caching Patterns

### Cache Warming on Main

Ensure the default branch always has a warm cache:

```yaml
name: Warm Cache

on:
  push:
    branches: [main]
    paths:
      - 'package-lock.json'
      - 'Cargo.lock'

jobs:
  warm-cache:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
```

### Selective Caching

Don't cache everything. Cache what's expensive:

```yaml
- uses: actions/cache@v4
  with:
    path: |
      ~/.cargo/bin/
      ~/.cargo/registry/index/
      ~/.cargo/registry/cache/
      ~/.cargo/git/db/
      target/
    key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}
    restore-keys: |
      ${{ runner.os }}-cargo-
```

### Turbo/Nx Build Cache

For monorepos, tools like Turborepo cache individual package builds:

```yaml
- uses: actions/cache@v4
  with:
    path: .turbo
    key: ${{ runner.os }}-turbo-${{ github.sha }}
    restore-keys: |
      ${{ runner.os }}-turbo-
```

---

## Measuring Cache Effectiveness

```
METRICS TO TRACK

  Metric                    Good        Bad
  -----------------------------------------------
  Cache hit rate            >80%        <50%
  Time saved per hit        >30 sec     <5 sec (not worth caching)
  Cache size                <2 GB       >5 GB (evicts other caches)
  Pipeline time with cache  <5 min      >15 min
```

Check your cache usage: Repository → Actions → Caches (in the
management section). You'll see which caches exist, their sizes,
and when they were last used.

---

## Complete Example: Build + Cache + Artifacts

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - run: npm run lint
      - run: npx tsc --noEmit
      - run: npm test

      - run: npm run build
        env:
          NODE_ENV: production

      - uses: actions/upload-artifact@v4
        if: github.ref == 'refs/heads/main'
        with:
          name: production-build-${{ github.sha }}
          path: dist/
          retention-days: 14

  deploy:
    if: github.ref == 'refs/heads/main'
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: production-build-${{ github.sha }}
          path: dist/

      - name: Deploy to production
        run: echo "Deploying dist/ to production..."
```

---

## Exercises

1. **Measure the difference**: Run your CI pipeline without caching.
   Note the total time. Add dependency caching. Run again. What's
   the speedup?

2. **Upload and download**: Create a workflow with two jobs. The first
   builds and uploads an artifact. The second downloads it and lists
   the files.

3. **Cache invalidation**: Change a dependency in package.json. Push
   and verify the cache misses (new key). Then push without changing
   dependencies and verify the cache hits.

4. **Artifact retention**: Upload an artifact with `retention-days: 1`.
   Check the next day — is it still there?

---

[Next: Lesson 10 — Environment Variables & Secrets](./10-env-vars-secrets.md)
