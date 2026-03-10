# Lesson 04: GitHub Actions Intro

> **The one thing to remember**: GitHub Actions is a robot that lives
> inside your GitHub repository. Every time something happens (you push
> code, open a PR, create a release), the robot wakes up, follows your
> instructions written in a YAML file, and reports back whether
> everything passed or failed.

---

## The Factory Assembly Line Analogy

Think of a car factory:

```
A CAR FACTORY

  EVENT: "New car order placed"
       |
       v
  WORKFLOW: "Build a car"
       |
       +---> JOB 1: Build the frame
       |        Step 1: Cut steel
       |        Step 2: Weld frame
       |        Step 3: Inspect welds
       |
       +---> JOB 2: Install engine
       |        Step 1: Mount engine block
       |        Step 2: Connect fuel lines
       |        Step 3: Test ignition
       |
       +---> JOB 3: Paint & finish
                Step 1: Apply primer
                Step 2: Paint
                Step 3: Clear coat
```

GitHub Actions works the same way:

```
GITHUB ACTIONS STRUCTURE

  EVENT: "Push to main"
       |
       v
  WORKFLOW: "CI Pipeline"  (.github/workflows/ci.yml)
       |
       +---> JOB 1: "lint"
       |        Step 1: Checkout code
       |        Step 2: Install Node
       |        Step 3: Run ESLint
       |
       +---> JOB 2: "test"
       |        Step 1: Checkout code
       |        Step 2: Install Node
       |        Step 3: Run tests
       |
       +---> JOB 3: "build"
                Step 1: Checkout code
                Step 2: Install Node
                Step 3: Build project
```

---

## The Vocabulary

Before writing any YAML, let's nail down the terms:

```
GITHUB ACTIONS GLOSSARY

  WORKFLOW     The entire automated process. Defined in a .yml file.
               Like a complete recipe book.

  EVENT        What triggers the workflow. A push, PR, schedule, etc.
               Like the dinner bell that tells the kitchen to start.

  JOB          A group of steps that run on the same machine.
               Like one station in the kitchen (grill, prep, dessert).

  STEP         A single task within a job. Either a shell command
               or a pre-built action.
               Like one instruction in a recipe ("chop onions").

  ACTION       A reusable, pre-built step. Written by GitHub or the
               community. Like a kitchen gadget that does one thing
               well (food processor = actions/checkout).

  RUNNER       The machine that executes your job. GitHub provides
               free Linux, macOS, and Windows runners.
               Like the kitchen itself — the physical space where
               work happens.
```

```
HOW THEY FIT TOGETHER

  .github/workflows/ci.yml    <--- WORKFLOW file
  │
  ├── on: push                <--- EVENT (trigger)
  │
  ├── jobs:                   <--- JOBS (parallel by default)
  │   ├── lint:               <--- JOB
  │   │   ├── runs-on: ubuntu <--- RUNNER
  │   │   └── steps:          <--- STEPS
  │   │       ├── uses: ...   <--- ACTION (pre-built)
  │   │       └── run: ...    <--- Shell command
  │   │
  │   └── test:               <--- Another JOB
  │       └── steps: ...
```

---

## Your First Workflow

Create this file in your repository:

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run tests
        run: npm test

      - name: Build
        run: npm run build
```

Let's break down every line:

```yaml
name: CI
```
The name that appears in the GitHub UI. Pick something descriptive.

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
```
**Events**: This workflow runs when code is pushed to main OR when a PR
targeting main is opened/updated.

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
```
**Job** named "build" running on a fresh Ubuntu Linux machine. Each job
gets a brand-new machine — nothing left over from previous runs.

```yaml
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
```
**Step 1**: Use the pre-built `actions/checkout` action. This clones
your repository into the runner. Without this, the runner has an empty
machine with no code.

```yaml
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
```
**Step 2**: Install Node.js version 20 on the runner. The `with:` block
passes configuration to the action.

```yaml
      - name: Install dependencies
        run: npm ci
```
**Step 3**: Run a shell command. `npm ci` is like `npm install` but
stricter — it uses the exact versions from `package-lock.json`.

---

## YAML Syntax: The Essentials

GitHub Actions uses YAML. If you've never used YAML, here's what you
need:

```yaml
# Comments start with #

# Strings (usually no quotes needed)
name: My Workflow

# Lists (use - prefix)
branches:
  - main
  - develop

# Or inline lists
branches: [main, develop]

# Nested objects (indentation matters — use 2 spaces, NEVER tabs)
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: First step
        run: echo "hello"

# Multi-line strings (use |)
      - name: Run script
        run: |
          echo "line 1"
          echo "line 2"
          npm test

# Boolean values
      - name: Upload results
        if: success()
        uses: actions/upload-artifact@v4
```

```
YAML GOTCHAS

  WRONG                          RIGHT
  ---------------------------------------------------------
  Using tabs for indentation     Use spaces (2 per level)
  Inconsistent indentation       Every level = exactly 2 spaces
  Missing space after colon      name: CI  (space after :)
  Unquoted special characters    "on": push  (on is a YAML keyword)
```

---

## Common Events (Triggers)

```yaml
# Trigger on push to specific branches
on:
  push:
    branches: [main, develop]

# Trigger on PRs
on:
  pull_request:
    branches: [main]

# Trigger on schedule (cron syntax)
on:
  schedule:
    - cron: '0 6 * * 1'   # Every Monday at 6 AM UTC

# Trigger on release
on:
  release:
    types: [published]

# Trigger manually (workflow_dispatch)
on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Deploy to which env?'
        required: true
        default: 'staging'

# Multiple triggers
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * *'   # Nightly
```

```
CRON SYNTAX CHEAT SHEET

  ┌───────── minute (0-59)
  │ ┌─────── hour (0-23)
  │ │ ┌───── day of month (1-31)
  │ │ │ ┌─── month (1-12)
  │ │ │ │ ┌─ day of week (0-6, 0=Sunday)
  │ │ │ │ │
  * * * * *

  Examples:
  '0 6 * * 1'        Every Monday at 6:00 AM
  '0 0 * * *'        Every day at midnight
  '*/15 * * * *'     Every 15 minutes
  '0 9 1 * *'        First day of every month at 9 AM
```

---

## Runners: Where Your Code Runs

```
AVAILABLE GITHUB-HOSTED RUNNERS

  Runner                  OS             CPU    RAM    Disk
  ----------------------------------------------------------
  ubuntu-latest           Ubuntu 22.04   2      7 GB   14 GB
  ubuntu-24.04            Ubuntu 24.04   2      7 GB   14 GB
  windows-latest          Windows 2022   2      7 GB   14 GB
  macos-latest            macOS 14       3      7 GB   14 GB
  macos-13                macOS 13       3      14 GB  14 GB

  Free tier limits (per month):
  - Public repos: Unlimited minutes
  - Private repos: 2,000 minutes (Linux)
  - macOS minutes count as 10x
  - Windows minutes count as 2x
```

Each job starts with a **fresh** runner. No state from previous runs.
This is important — it means your pipeline is reproducible. No "but it
worked last time" issues.

```
RUNNER LIFECYCLE

  Job starts
       |
       v
  Fresh VM created (clean Ubuntu/macOS/Windows)
       |
       v
  Your steps execute one by one
       |
       v
  Job ends (pass or fail)
       |
       v
  VM is destroyed (everything is deleted)
```

---

## Pre-Built Actions: Don't Reinvent the Wheel

The GitHub Marketplace has thousands of actions. These are the ones
you'll use in almost every workflow:

```yaml
# Checkout your code (required in almost every job)
- uses: actions/checkout@v4

# Set up language runtimes
- uses: actions/setup-node@v4      # Node.js
- uses: actions/setup-python@v5    # Python
- uses: actions/setup-go@v5        # Go
- uses: dtolnay/rust-toolchain@stable  # Rust

# Caching (speed up builds)
- uses: actions/cache@v4

# Upload/download build artifacts
- uses: actions/upload-artifact@v4
- uses: actions/download-artifact@v4
```

The `@v4` part is the version. Always pin to a major version to avoid
breaking changes.

---

## Viewing Workflow Results

When a workflow runs, you can see results on GitHub:

```
WHERE TO FIND WORKFLOW RESULTS

  1. Repository page → "Actions" tab
     Shows all workflow runs with status (pass/fail)

  2. Pull Request → Checks section
     Shows which checks passed/failed for this PR

  3. Commit status
     Green checkmark (✓) = all workflows passed
     Red X (✗) = something failed
     Yellow dot (●) = still running
```

When a step fails, GitHub shows you the exact log output. This is your
first stop for debugging.

---

## A More Realistic Example

Here's a workflow for a TypeScript project with separate jobs:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx tsc --noEmit

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm test

  build:
    needs: [lint, typecheck, test]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
```

Notice `needs: [lint, typecheck, test]` — the build job only runs
after all three check jobs pass. Lint, typecheck, and test run in
parallel (faster!).

```
JOB EXECUTION ORDER

  push to main
       |
       +---> lint ─────────────+
       |                       |
       +---> typecheck ────────+──> build
       |                       |
       +---> test ─────────────+

  lint, typecheck, test: run in PARALLEL
  build: runs AFTER all three pass
```

---

## Exercises

1. **Create your first workflow**: Make a new repository, add a simple
   `index.js` file, and create `.github/workflows/ci.yml` that runs
   `node index.js`. Push to GitHub and watch it run in the Actions tab.

2. **Add multiple events**: Modify your workflow to trigger on both
   push and pull_request. Create a branch, push to it, open a PR, and
   verify the workflow runs.

3. **Explore the marketplace**: Go to github.com/marketplace and search
   for "setup-node". Read the README. Look at how `with:` parameters
   are documented.

4. **Break it on purpose**: Change your workflow to run a command that
   doesn't exist (like `npm run nonexistent`). Push and observe the
   failure output in the Actions tab.

---

[Next: Lesson 05 — Workflows, Jobs, and Steps](./05-workflows-jobs-steps.md)
