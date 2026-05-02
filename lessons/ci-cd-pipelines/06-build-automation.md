# Lesson 06: Build Automation

> **The one thing to remember**: A build is like baking a cake from a
> recipe. You start with raw ingredients (source code), follow exact
> steps (compile, bundle, optimize), and produce a finished product
> (the artifact). Build automation means a machine follows the recipe
> the same way every single time — no "I forgot the sugar" moments.

---

## The Bakery Analogy

```
HAND-BAKED (Manual Build)             FACTORY-BAKED (Automated Build)

  Chef eyeballs flour amount           Scale measures exactly 500g
  Oven "feels" about right             Oven set to exactly 175°C
  "Done when it looks golden"          Timer goes off at 25 minutes
  Different every time                 Identical every time
  Can't explain what went wrong        Exact log of every step

  Result: Sometimes great,             Result: Consistent quality,
  sometimes disaster                   every single time
```

Build automation gives you reproducibility. If the build works today,
it works tomorrow. If it works on the CI server, it works on your
machine. Same inputs, same outputs, every time.

---

## What Does "Building" Mean?

Different languages have different build steps:

```
WHAT "BUILD" MEANS PER LANGUAGE

  Language     Raw Input            Build Steps                   Output
  -------------------------------------------------------------------------
  JavaScript   .js/.ts files       Bundle, minify, transpile     .js bundle
  TypeScript   .ts files           Type-check, compile to JS     .js files
  Rust         .rs files           Compile, link                 Binary
  Go           .go files           Compile, link                 Binary
  Python       .py files           Package (wheel/sdist)         .whl/.tar.gz
  Java         .java files         Compile to bytecode, JAR      .jar file
  C/C++        .c/.cpp files       Preprocess, compile, link     Binary
  Docker       Dockerfile          Build layers, create image    Container image
```

For a typical web application:

```
WEB APP BUILD PIPELINE

  Source Code                    Build Steps                     Output
  +-----------+
  | app.tsx   |     1. Install dependencies (npm ci)
  | utils.ts  |     2. Type-check (tsc --noEmit)
  | style.css | --> 3. Compile TypeScript to JavaScript      --> dist/
  | image.png |     4. Bundle modules into chunks                ├── index.html
  | index.html|     5. Minify JavaScript and CSS                 ├── app.a1b2c3.js
  +-----------+     6. Optimize images                           ├── style.d4e5f6.css
                    7. Generate source maps                      ├── image.opt.png
                    8. Hash filenames for cache busting          └── app.a1b2c3.js.map
```

---

## Build Tools by Ecosystem

### JavaScript/TypeScript: npm scripts + bundlers

```json
{
  "scripts": {
    "build": "vite build",
    "build:check": "tsc --noEmit && vite build",
    "preview": "vite preview"
  }
}
```

Common bundlers:
```
JAVASCRIPT BUNDLERS

  Tool       Speed      Config      Best For
  -----------------------------------------------
  Vite       Very fast  Minimal     Modern web apps
  esbuild    Fastest    Minimal     Libraries, simple apps
  webpack    Moderate   Verbose     Complex legacy apps
  Rollup     Fast       Moderate    Libraries
  Turbopack  Very fast  Minimal     Next.js apps
```

### Rust: Cargo

```bash
cargo build --release
```

Cargo handles dependency resolution, compilation, and linking. The
`--release` flag enables optimizations (smaller, faster binary, but
slower compilation).

```toml
# Cargo.toml
[package]
name = "my-app"
version = "0.1.0"
edition = "2021"

[profile.release]
opt-level = 3
lto = true
strip = true
```

### Go: go build

```bash
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o server ./cmd/server
```

Go cross-compiles effortlessly. Build a Linux binary on macOS with
just environment variables.

### Make: The Universal Build Tool

`make` has been around since 1976 and works with any language:

```makefile
# Makefile

.PHONY: build test lint clean

build:
	npm run build

test:
	npm test

lint:
	npm run lint

clean:
	rm -rf dist node_modules

ci: lint test build

deploy: ci
	./scripts/deploy.sh
```

```bash
make ci        # runs lint, test, build in order
make deploy    # runs ci first (dependency), then deploy
make clean     # remove build artifacts
```

```
WHY MAKE IS STILL USEFUL

  1. Language-agnostic: Works with any tool
  2. Dependencies: "deploy depends on ci" is built-in
  3. Conventional: Every developer knows "make build"
  4. Idempotent: Only rebuilds what changed (for file targets)
  5. Simple: Just shell commands with dependency tracking
```

---

## Reproducible Builds

A reproducible build means: same source code + same tools = same
output, every time, on every machine.

```
NON-REPRODUCIBLE BUILD (common problems)

  Developer A's machine          CI Server
  +--------------------+         +--------------------+
  | Node 20.11.0       |         | Node 20.9.0        |  ← different version!
  | npm 10.2.4         |         | npm 10.1.0         |  ← different version!
  | lodash@4.17.21     |         | lodash@4.17.20     |  ← different version!
  | macOS              |         | Linux              |
  +--------------------+         +--------------------+
        |                              |
        v                              v
  Build succeeds                 Build fails
  "Works on my machine!"        "But not on CI..."
```

**Solutions for reproducible builds:**

### 1. Lock Files

```
LOCK FILES BY ECOSYSTEM

  Ecosystem    Lock File              Install Command
  -------------------------------------------------------
  npm          package-lock.json      npm ci
  yarn         yarn.lock              yarn install --frozen-lockfile
  pnpm         pnpm-lock.yaml         pnpm install --frozen-lockfile
  Rust         Cargo.lock             cargo build (uses lock automatically)
  Go           go.sum                 go build (uses sum automatically)
  Python       requirements.txt       pip install -r requirements.txt
               poetry.lock            poetry install
```

`npm ci` (not `npm install`) is critical in CI:

```
npm install vs npm ci

  npm install                    npm ci
  ---------------------------    ---------------------------
  May update lock file           Never updates lock file
  May resolve newer versions     Uses EXACT lock file versions
  Slower                         Faster
  For development                For CI/CD

  ALWAYS use npm ci in pipelines.
```

### 2. Pin Tool Versions

```yaml
# GitHub Actions: pin Node version
- uses: actions/setup-node@v4
  with:
    node-version: '20.11.0'   # Exact version, not just '20'

# Docker: pin base image
FROM node:20.11.0-alpine3.19   # Exact version, not 'node:latest'

# Rust: pin toolchain
- uses: dtolnay/rust-toolchain@stable
  with:
    toolchain: '1.77.0'       # Exact version
```

### 3. Docker for Full Reproducibility

```dockerfile
FROM node:20.11.0-alpine3.19 AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.25.4-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
```

Docker ensures the OS, libraries, and tools are identical everywhere.

---

## Build Caching

Builds are slow. Caching makes them fast by reusing work from previous
builds:

```
BUILD WITHOUT CACHING              BUILD WITH CACHING

  1. Install 500 dependencies       1. Cache hit! Skip install (0s)
     (45 seconds)
  2. Compile TypeScript              2. Only recompile changed files
     (30 seconds)                       (3 seconds)
  3. Bundle and minify               3. Rebuild only changed chunks
     (15 seconds)                       (5 seconds)
  ---                                ---
  Total: 90 seconds                  Total: 8 seconds
```

### Dependency Caching in GitHub Actions

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'
```

That one line (`cache: 'npm'`) tells the action to cache the npm
dependency folder. If `package-lock.json` hasn't changed, deps are
restored from cache instead of downloaded.

### Manual Caching

For more control:

```yaml
- uses: actions/cache@v4
  with:
    path: |
      ~/.cargo/registry
      ~/.cargo/git
      target
    key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}
    restore-keys: |
      ${{ runner.os }}-cargo-
```

```
HOW CACHING WORKS

  First run:
  1. Check cache for key "linux-cargo-abc123" → MISS
  2. Run cargo build (slow, full compile)
  3. Save target/ directory to cache with key "linux-cargo-abc123"

  Second run (same Cargo.lock):
  1. Check cache for key "linux-cargo-abc123" → HIT!
  2. Restore target/ directory from cache
  3. Run cargo build (fast, only recompiles changed files)

  After updating Cargo.lock:
  1. Check cache for key "linux-cargo-def456" → MISS
  2. Check restore-keys "linux-cargo-" → partial match!
  3. Restore closest match (better than nothing)
  4. Run cargo build (medium speed, some recompilation)
```

---

## Build Artifacts

A build artifact is the output of your build — the thing you actually
deploy:

```
COMMON BUILD ARTIFACTS

  Project Type        Artifact             Example
  ---------------------------------------------------------
  Web app             Static files         dist/ folder
  Node.js API         Docker image         myapp:v1.2.3
  Rust CLI            Binary               target/release/myapp
  Go service          Binary               server
  Mobile app          APK/IPA              app-release.apk
  Python package      Wheel                mylib-1.0.0-py3-none-any.whl
```

Saving artifacts in GitHub Actions:

```yaml
- name: Build
  run: npm run build

- name: Upload build artifact
  uses: actions/upload-artifact@v4
  with:
    name: dist
    path: dist/
    retention-days: 7
```

A later job (like deploy) can download the artifact:

```yaml
deploy:
  needs: build
  runs-on: ubuntu-latest
  steps:
    - uses: actions/download-artifact@v4
      with:
        name: dist
        path: dist/

    - name: Deploy
      run: ./deploy.sh dist/
```

---

## A Complete Build Workflow

```yaml
name: Build

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npx tsc --noEmit

      - name: Build
        run: npm run build
        env:
          NODE_ENV: production

      - name: Verify build output
        run: |
          test -d dist || (echo "Build output missing!" && exit 1)
          test -f dist/index.html || (echo "index.html missing!" && exit 1)

      - name: Upload artifact
        if: github.ref == 'refs/heads/main'
        uses: actions/upload-artifact@v4
        with:
          name: production-build
          path: dist/
          retention-days: 30
```

---

## Exercises

1. **Create a Makefile**: For any project you have, create a Makefile
   with targets for `build`, `test`, `lint`, `clean`, and `ci`.

2. **Measure caching impact**: In a GitHub Actions workflow, run the
   build twice — once without caching, once with. Compare the times
   in the Actions tab.

3. **Verify reproducibility**: Run `npm ci && npm run build` on your
   machine. Run the same in CI. Compare the output. Are they
   identical? If not, why?

4. **Upload an artifact**: Create a workflow that builds your project
   and uploads the output as an artifact. Download it from the Actions
   tab and verify it's correct.

---

[Next: Lesson 07 — Automated Testing in CI](./07-automated-testing-ci.md)
