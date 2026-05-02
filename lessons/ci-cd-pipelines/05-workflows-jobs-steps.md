# Lesson 05: Workflows, Jobs, and Steps — Deep Dive

> **The one thing to remember**: A workflow is a recipe. Jobs are the
> dishes you're making in parallel. Steps are the individual instructions
> within each dish. Jobs get their own kitchen (runner), so they can't
> share ingredients unless you explicitly pass them between kitchens.

---

## The Catering Company Analogy

You're running a catering company for a wedding. You need to serve
appetizers, main course, and dessert.

```
CATERING FOR A WEDDING (= CI/CD WORKFLOW)

  EVENT: "Wedding day arrives"
       |
       v
  WORKFLOW: "Serve the wedding"
       |
       ├── JOB: "Appetizers" (Kitchen A)
       │     Step 1: Prep vegetables
       │     Step 2: Make bruschetta
       │     Step 3: Plate appetizers
       │
       ├── JOB: "Main Course" (Kitchen B)    ← All 3 run in PARALLEL
       │     Step 1: Season the beef          (different kitchens!)
       │     Step 2: Roast for 3 hours
       │     Step 3: Make gravy
       │
       ├── JOB: "Dessert" (Kitchen C)
       │     Step 1: Bake cake layers
       │     Step 2: Make frosting
       │     Step 3: Assemble & decorate
       │
       └── JOB: "Serve Everything" (Kitchen D)
             needs: [Appetizers, Main Course, Dessert]
             Step 1: Collect all dishes     ← Runs AFTER all 3 finish
             Step 2: Arrange on tables
             Step 3: Ring the dinner bell
```

Key insight: Kitchen A, B, and C are **separate physical kitchens**.
They can't reach over and grab something from each other. If Kitchen D
needs the cake from Kitchen C, you have to explicitly carry it over
(artifacts).

---

## Job Dependencies with `needs`

By default, jobs run in parallel. Use `needs` to create order:

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run lint

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test

  build:
    needs: [lint, test]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run build

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - run: echo "Deploying..."
```

```
EXECUTION GRAPH

  lint ──────┐
             ├──> build ──> deploy
  test ──────┘

  Timeline:
  ┌──────┐┌──────┐
  │ lint ││ test │   (parallel, ~3 min each)
  └──────┘└──────┘
           ┌──────────┐
           │  build   │   (after both, ~2 min)
           └──────────┘
                    ┌──────────┐
                    │  deploy  │   (after build, ~1 min)
                    └──────────┘
  Total: ~6 min (not 9 min if sequential)
```

---

## Job Outputs: Passing Data Between Jobs

Since each job runs on a separate machine, you need to explicitly pass
data between them:

```yaml
jobs:
  version:
    runs-on: ubuntu-latest
    outputs:
      app_version: ${{ steps.get_version.outputs.version }}
    steps:
      - uses: actions/checkout@v4
      - id: get_version
        run: |
          VERSION=$(cat package.json | jq -r .version)
          echo "version=$VERSION" >> $GITHUB_OUTPUT

  build:
    needs: version
    runs-on: ubuntu-latest
    steps:
      - run: echo "Building version ${{ needs.version.outputs.app_version }}"
```

```
DATA FLOW BETWEEN JOBS

  Job: version                      Job: build
  +--------------------------+      +---------------------------+
  | Step: get_version        |      |                           |
  |   VERSION="1.2.3"       |      | echo "Building v1.2.3"   |
  |   echo >> GITHUB_OUTPUT |----->| ${{ needs.version...}}    |
  +--------------------------+      +---------------------------+
         outputs.app_version -----> needs.version.outputs.app_version
```

---

## Matrix Builds: Test Across Multiple Configurations

Need to test on Node 18, 20, AND 22? On Ubuntu AND macOS? Matrix
builds run your job across every combination:

```yaml
jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest]
        node-version: [18, 20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci
      - run: npm test
```

This creates 6 jobs (2 OS x 3 Node versions):

```
MATRIX EXPANSION (2 x 3 = 6 jobs)

  ┌─────────────────┬──────────┬──────────┬──────────┐
  │                  │ Node 18  │ Node 20  │ Node 22  │
  ├─────────────────┼──────────┼──────────┼──────────┤
  │ ubuntu-latest   │  Job 1   │  Job 2   │  Job 3   │
  │ macos-latest    │  Job 4   │  Job 5   │  Job 6   │
  └─────────────────┴──────────┴──────────┴──────────┘

  All 6 run in parallel!
```

### Matrix Exclusions and Inclusions

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, macos-latest, windows-latest]
    node-version: [18, 20, 22]
    exclude:
      - os: windows-latest
        node-version: 18
    include:
      - os: ubuntu-latest
        node-version: 22
        experimental: true
```

### Fail-Fast Behavior

By default, if one matrix job fails, all other matrix jobs are
cancelled. To change this:

```yaml
strategy:
  fail-fast: false
  matrix:
    os: [ubuntu-latest, macos-latest]
    node-version: [18, 20, 22]
```

With `fail-fast: false`, all 6 jobs run to completion even if one
fails. Useful for seeing the full picture of what's broken.

---

## Conditional Steps with `if`

Control which steps or jobs run based on conditions:

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install deps
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Build
        run: npm run build

      - name: Deploy to staging
        if: github.ref == 'refs/heads/main'
        run: ./deploy.sh staging

      - name: Deploy to production
        if: github.ref == 'refs/heads/main' && github.event_name == 'push'
        run: ./deploy.sh production

      - name: Upload coverage (even if tests fail)
        if: always()
        run: npm run coverage:upload

      - name: Notify on failure
        if: failure()
        run: curl -X POST $SLACK_WEBHOOK -d '{"text":"Build failed!"}'
```

```
CONDITIONAL EXPRESSIONS

  Expression                          When it's true
  ---------------------------------------------------------------
  github.ref == 'refs/heads/main'     Push to main branch
  github.event_name == 'pull_request' Triggered by PR
  matrix.os == 'ubuntu-latest'        Current matrix combo is Ubuntu
  success()                           All previous steps passed
  failure()                           Any previous step failed
  always()                            Run no matter what
  cancelled()                         Workflow was cancelled
  contains(github.event.head_commit.message, '[skip ci]')
                                      Commit message has [skip ci]
```

---

## Reusable Workflows

When multiple repositories need the same CI pipeline, don't copy-paste.
Create a reusable workflow:

**The reusable workflow (in a shared repo):**

```yaml
# .github/workflows/node-ci.yml (in org/shared-workflows repo)
name: Reusable Node.js CI

on:
  workflow_call:
    inputs:
      node-version:
        required: false
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
      - run: npm run lint
      - run: npm test
      - run: npm run build
```

**Calling it from another repo:**

```yaml
# .github/workflows/ci.yml (in your app repo)
name: CI

on:
  push:
    branches: [main]

jobs:
  ci:
    uses: org/shared-workflows/.github/workflows/node-ci.yml@main
    with:
      node-version: '20'
    secrets:
      npm-token: ${{ secrets.NPM_TOKEN }}
```

```
REUSABLE WORKFLOW ARCHITECTURE

  shared-workflows repo           app-1 repo          app-2 repo
  +-------------------+          +-----------+        +-----------+
  | node-ci.yml       |<---------| ci.yml    |        | ci.yml    |
  |   lint             |          | uses:     |        | uses:     |
  |   test             |<---------|  shared/  |        |  shared/  |
  |   build            |          |  node-ci  |------->|  node-ci  |
  +-------------------+          +-----------+        +-----------+

  One workflow definition, used by many repos.
  Update once, all repos get the fix.
```

---

## Composite Actions

For reusable steps (not full workflows), create composite actions:

```yaml
# .github/actions/setup-and-install/action.yml
name: 'Setup and Install'
description: 'Checkout, setup Node, install deps'

inputs:
  node-version:
    description: 'Node.js version'
    required: false
    default: '20'

runs:
  using: 'composite'
  steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0

    - uses: actions/setup-node@v4
      with:
        node-version: ${{ inputs.node-version }}
        cache: 'npm'

    - run: npm ci
      shell: bash
```

Use it in your workflows:

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/setup-and-install
        with:
          node-version: '20'
      - run: npm run lint

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/setup-and-install
      - run: npm test
```

---

## Timeouts and Concurrency

### Job Timeouts

Prevent stuck jobs from burning your minutes:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - run: npm test
```

### Concurrency Control

Prevent multiple deploys from running at the same time:

```yaml
concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: true
```

```
CONCURRENCY IN ACTION

  Push 1 triggers deploy → starts running
  Push 2 triggers deploy → cancels push 1's deploy, starts its own
  Push 3 triggers deploy → cancels push 2's deploy, starts its own

  Only the latest push's deploy runs to completion.
  Saves time and prevents deployment conflicts.
```

---

## Environment Variables in Steps

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    env:
      NODE_ENV: production
    steps:
      - uses: actions/checkout@v4

      - name: Build with env vars
        env:
          API_URL: https://api.example.com
        run: |
          echo "NODE_ENV is $NODE_ENV"
          echo "API_URL is $API_URL"
          npm run build
```

Environment variables can be set at three levels:
- **Workflow level**: Available to all jobs
- **Job level**: Available to all steps in that job
- **Step level**: Available only to that step

---

## Exercises

1. **Job dependencies**: Create a workflow with 4 jobs: lint, test,
   build, deploy. Make build depend on lint and test. Make deploy
   depend on build. Push and verify the execution order in the Actions
   tab.

2. **Matrix build**: Create a workflow that runs tests on Node 18,
   20, and 22 on both Ubuntu and macOS. That's 6 combinations.

3. **Conditional steps**: Add a step that only runs on the main
   branch. Add another that runs only when tests fail. Test both
   conditions.

4. **Job outputs**: Create a job that reads the version from
   `package.json` and passes it to a second job that echoes it.

5. **Reusable workflow**: Create a reusable workflow in one repo and
   call it from another. (Requires two GitHub repos.)

---

[Next: Lesson 06 — Build Automation](./06-build-automation.md)
