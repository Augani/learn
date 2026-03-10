# Quick Reference: GitHub Actions

> A compact reference for GitHub Actions syntax, common actions, and
> workflow patterns. Keep this open while writing workflows.

---

## Workflow File Location

All workflow files live in `.github/workflows/` and must be `.yml` or
`.yaml` files.

```
your-repo/
└── .github/
    └── workflows/
        ├── ci.yml
        ├── deploy.yml
        └── nightly.yml
```

---

## Workflow Structure

```yaml
name: Workflow Name                # Display name in GitHub UI

on:                                # Event triggers
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:                       # Permissions for GITHUB_TOKEN
  contents: read

env:                               # Workflow-level env vars
  NODE_ENV: production

concurrency:                       # Prevent parallel runs
  group: ${{ github.ref }}
  cancel-in-progress: true

jobs:                              # One or more jobs
  job-name:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - name: Step name
        run: echo "hello"
```

---

## Events (Triggers)

```yaml
# Push to branches
on:
  push:
    branches: [main, develop]
    paths: ['src/**', 'package.json']
    tags: ['v*']

# Pull requests
on:
  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened]

# Manual trigger
on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target environment'
        required: true
        type: choice
        options: [staging, production]

# Schedule (cron)
on:
  schedule:
    - cron: '0 6 * * 1-5'     # Weekdays at 6 AM UTC

# Release
on:
  release:
    types: [published]

# Called by another workflow
on:
  workflow_call:
    inputs:
      node-version:
        type: string
        default: '20'
    secrets:
      deploy-token:
        required: true
```

---

## Job Configuration

```yaml
jobs:
  build:
    name: Build App                      # Display name
    runs-on: ubuntu-latest               # Runner OS
    timeout-minutes: 15                  # Kill if exceeds
    if: github.event_name == 'push'      # Conditional

    environment: production              # GitHub environment
    env:                                 # Job-level env vars
      CI: true

    outputs:                             # Pass data to other jobs
      version: ${{ steps.ver.outputs.version }}

    strategy:                            # Matrix builds
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest]
        node: [18, 20, 22]
        exclude:
          - os: macos-latest
            node: 18

    needs: [lint, test]                  # Job dependencies
    permissions:
      contents: read
      packages: write
```

---

## Step Types

```yaml
steps:
  # Use a pre-built action
  - name: Checkout
    uses: actions/checkout@v4
    with:
      fetch-depth: 0

  # Run a shell command
  - name: Install
    run: npm ci

  # Multi-line shell command
  - name: Build and test
    run: |
      npm run build
      npm test

  # Conditional step
  - name: Deploy
    if: github.ref == 'refs/heads/main'
    run: ./deploy.sh

  # Step with ID (for outputs)
  - name: Get version
    id: ver
    run: echo "version=$(cat package.json | jq -r .version)" >> $GITHUB_OUTPUT

  # Step with env vars
  - name: Upload
    run: ./upload.sh
    env:
      AWS_KEY: ${{ secrets.AWS_KEY }}

  # Always run (even after failure)
  - name: Cleanup
    if: always()
    run: ./cleanup.sh

  # Run only on failure
  - name: Notify
    if: failure()
    run: ./notify-slack.sh
```

---

## Essential Actions

```yaml
# Checkout code
- uses: actions/checkout@v4
  with:
    fetch-depth: 0          # Full history (for tags, blame)
    # fetch-depth: 1        # Shallow (default, faster)

# Setup Node.js
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'             # Auto-cache node_modules

# Setup Python
- uses: actions/setup-python@v5
  with:
    python-version: '3.12'
    cache: 'pip'

# Setup Go
- uses: actions/setup-go@v5
  with:
    go-version: '1.22'

# Setup Rust
- uses: dtolnay/rust-toolchain@stable
  with:
    components: clippy, rustfmt

# Cache
- uses: actions/cache@v4
  with:
    path: ~/.cache/my-tool
    key: ${{ runner.os }}-tool-${{ hashFiles('lockfile') }}
    restore-keys: ${{ runner.os }}-tool-

# Upload artifact
- uses: actions/upload-artifact@v4
  with:
    name: my-artifact
    path: dist/
    retention-days: 7
    if-no-files-found: error

# Download artifact
- uses: actions/download-artifact@v4
  with:
    name: my-artifact
    path: dist/
```

---

## Context Variables

```yaml
# GitHub context
${{ github.sha }}                    # Full commit SHA
${{ github.ref }}                    # refs/heads/main or refs/pull/1/merge
${{ github.ref_name }}               # main or 1/merge
${{ github.event_name }}             # push, pull_request, etc.
${{ github.actor }}                  # Username who triggered
${{ github.repository }}             # owner/repo
${{ github.workspace }}              # /home/runner/work/repo/repo

# Secrets
${{ secrets.MY_SECRET }}             # Repository or environment secret

# Variables (non-secret)
${{ vars.MY_VARIABLE }}              # Repository or environment variable

# Job outputs (from another job)
${{ needs.build.outputs.version }}

# Step outputs
${{ steps.my-step.outputs.result }}

# Matrix values
${{ matrix.os }}
${{ matrix.node-version }}

# Runner info
${{ runner.os }}                     # Linux, macOS, Windows
${{ runner.arch }}                   # X64, ARM64
```

---

## Conditional Expressions

```yaml
# Branch checks
if: github.ref == 'refs/heads/main'
if: github.ref_name == 'main'
if: startsWith(github.ref, 'refs/tags/v')

# Event checks
if: github.event_name == 'push'
if: github.event_name == 'pull_request'

# Status checks
if: success()                        # All previous steps passed
if: failure()                        # Any previous step failed
if: always()                         # Always run
if: cancelled()                      # Workflow was cancelled

# String operations
if: contains(github.event.head_commit.message, '[skip ci]')
if: startsWith(matrix.os, 'ubuntu')
if: endsWith(github.actor, '-bot')

# Combine conditions
if: github.ref == 'refs/heads/main' && github.event_name == 'push'
if: failure() || cancelled()
```

---

## Service Containers

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: testdb
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7
        ports:
          - 6379:6379
```

---

## Reusable Workflows

**Defining (in shared repo):**

```yaml
# .github/workflows/reusable-ci.yml
on:
  workflow_call:
    inputs:
      node-version:
        type: string
        default: '20'
    secrets:
      npm-token:
        required: false

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ inputs.node-version }}
      - run: npm ci
      - run: npm test
```

**Calling:**

```yaml
jobs:
  ci:
    uses: org/shared/.github/workflows/reusable-ci.yml@main
    with:
      node-version: '20'
    secrets:
      npm-token: ${{ secrets.NPM_TOKEN }}
```

---

## Common Patterns

### Build Once, Deploy Multiple Environments

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: app-${{ github.sha }}
          path: dist/

  deploy-staging:
    needs: build
    environment: staging
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: app-${{ github.sha }}
      - run: ./deploy.sh staging

  deploy-prod:
    needs: deploy-staging
    environment: production
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: app-${{ github.sha }}
      - run: ./deploy.sh production
```

### Auto-merge Dependabot PRs

```yaml
name: Auto-merge Dependabot

on: pull_request

permissions:
  contents: write
  pull-requests: write

jobs:
  auto-merge:
    if: github.actor == 'dependabot[bot]'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: gh pr merge --auto --squash "$PR_URL"
        env:
          PR_URL: ${{ github.event.pull_request.html_url }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Docker Build and Push

```yaml
jobs:
  docker:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ghcr.io/${{ github.repository }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

---

## Debugging Tips

```yaml
# Print all context variables
- run: echo '${{ toJSON(github) }}'

# Enable debug logging (set in repo secrets)
# ACTIONS_RUNNER_DEBUG = true
# ACTIONS_STEP_DEBUG = true

# SSH into runner for debugging (use tmate action)
- uses: mxschmitt/action-tmate@v3
  if: failure()
```

---

## Limits

```
GITHUB ACTIONS LIMITS

  Free tier (private repos):      2,000 minutes/month
  Public repos:                   Unlimited
  Max workflow run time:          6 hours (35 days for scheduled)
  Max job run time:               6 hours
  Max concurrent jobs (free):     20 (Linux), 5 (macOS)
  Max matrix combinations:        256
  Artifact storage:               500 MB (free), up to 50 GB
  Cache storage per repo:         10 GB
  Workflow file size:             No specific limit
  Log retention:                  90 days (400 days for public)
```

---

[Back to Roadmap](./00-roadmap.md)
