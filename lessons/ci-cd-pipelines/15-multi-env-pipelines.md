# Lesson 15: Multi-Environment Pipelines

> **The one thing to remember**: Environments are like dress rehearsals
> before opening night. You don't debut a play directly on Broadway.
> First you rehearse in a small room (development), then on stage with
> no audience (staging), then opening night (production). Each rehearsal
> catches problems the previous one missed.

---

## The Theater Analogy

```
THEATER PRODUCTION PIPELINE

  Living Room Rehearsal (DEV)
  - Just the actors, scripts in hand
  - Improvise, make mistakes, experiment
  - Nobody watching, low stakes
       |
       v
  Full Dress Rehearsal (STAGING)
  - Real stage, real costumes, real lighting
  - Small invited audience (QA team)
  - Find problems with the FULL experience
  - "The trap door doesn't work!" (found before opening)
       |
       v
  Opening Night (PRODUCTION)
  - Real audience, real stakes
  - Everything tested and verified
  - Confidence because rehearsals caught the issues
```

---

## The Standard Environment Setup

```
ENVIRONMENT PIPELINE

  +----------+      +-----------+      +-------------+
  |   DEV    | ---> |  STAGING  | ---> | PRODUCTION  |
  +----------+      +-----------+      +-------------+
  |          |      |           |      |             |
  | Latest   |      | Release   |      | Stable      |
  | code     |      | candidate |      | version     |
  |          |      |           |      |             |
  | Devs use |      | QA tests  |      | Users use   |
  | daily    |      | here      |      |             |
  |          |      |           |      |             |
  | May be   |      | Should be |      | Must be     |
  | broken   |      | stable    |      | stable      |
  |          |      |           |      |             |
  | Auto-    |      | Auto-     |      | Manual      |
  | deploy   |      | deploy    |      | approval    |
  | on push  |      | after CI  |      | then deploy |
  +----------+      +-----------+      +-------------+
```

### What Each Environment Is For

```
ENVIRONMENT PURPOSES

  Environment   Who Uses It     Deploy Trigger     Purpose
  ----------------------------------------------------------------
  Development   Developers      Every push to      Test new features
  (dev)                         main               in isolation

  Staging       QA team,        After CI passes    Final verification
  (stage)       product team    on main            before production

  Production    End users       Manual approval    The real thing
  (prod)                        or auto after
                                staging passes

  Optional environments:
  ----------------------------------------------------------------
  Preview       PR authors      Every PR           Test individual PRs
  Sandbox       Partners/API    Manual             External testing
  Performance   SRE team        Scheduled          Load testing
  DR            Nobody (ready)  Emergency          Disaster recovery
```

---

## Environment-Specific Configuration

Each environment needs different configuration:

```
CONFIGURATION BY ENVIRONMENT

  Setting           Dev              Staging           Production
  -------------------------------------------------------------------
  Database URL      localhost:5432   staging-db.rds    prod-db.rds
  API URL           localhost:3000   api-staging.com   api.example.com
  Log level         debug            info              warn
  Feature flags     All ON           Match prod        Controlled
  Email sending     Disabled/mock    Sandbox mode      Real emails
  Payment gateway   Stripe test      Stripe test       Stripe live
  Error reporting   Console          Sentry (staging)  Sentry (prod)
  SSL               Self-signed      Real cert         Real cert
  Replicas          1                2                 4+
  CDN               None             Optional          CloudFront
```

### Managing Config with GitHub Environments

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-staging:
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run build
        env:
          API_URL: ${{ vars.API_URL }}
          NODE_ENV: production
      - run: ./scripts/deploy.sh staging
        env:
          DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run build
        env:
          API_URL: ${{ vars.API_URL }}
          NODE_ENV: production
      - run: ./scripts/deploy.sh production
        env:
          DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

Each `environment:` block uses different secrets and variables:

```
GITHUB ENVIRONMENTS

  Repository Settings → Environments

  +-----------------------+      +-----------------------+
  | staging               |      | production            |
  |-----------------------|      |-----------------------|
  | Secrets:              |      | Secrets:              |
  |   DATABASE_URL: stg.. |      |   DATABASE_URL: prd.. |
  |   DEPLOY_TOKEN: abc   |      |   DEPLOY_TOKEN: xyz   |
  | Variables:            |      | Variables:            |
  |   API_URL: api-stg..  |      |   API_URL: api.ex..   |
  | Protection:           |      | Protection:           |
  |   None                |      |   Required reviewers  |
  |                       |      |   Wait timer: 5 min   |
  +-----------------------+      +-----------------------+
```

---

## Promotion Workflows

"Promotion" means moving a build from one environment to the next:

```
PROMOTION WORKFLOW

  Code pushed to main
       |
       v
  CI: lint, test, build → produces artifact v1.2.3
       |
       v
  Auto-deploy to DEV
       |
  Smoke tests pass?
       ├── No → Alert team, stop
       └── Yes
              |
              v
  Auto-deploy to STAGING
       |
  Integration tests + QA pass?
       ├── No → Alert team, stop
       └── Yes
              |
              v
  Manual approval required
  (Team lead reviews staging)
       |
  Approved?
       ├── No → Fix issues, start over
       └── Yes
              |
              v
  Deploy to PRODUCTION
       |
  Post-deploy monitoring (15 min)
       |
  All metrics healthy?
       ├── No → AUTO ROLLBACK
       └── Yes → Success!
```

### Same Artifact, Different Config

A critical rule: **build once, deploy everywhere**. Don't rebuild
for each environment.

```
WRONG: Rebuild per environment

  Build for dev     → deploy to dev
  Build for staging → deploy to staging     ← Different builds!
  Build for prod    → deploy to production  ← Could have different bugs!

RIGHT: Build once, configure per environment

  Build artifact v1.2.3
       |
       ├── Deploy to dev     + dev config
       ├── Deploy to staging + staging config
       └── Deploy to prod    + production config

  Same artifact everywhere = what you tested is what you deploy.
```

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
          path: dist/
      - run: ./deploy.sh staging dist/
        env:
          API_URL: ${{ vars.API_URL }}

  deploy-production:
    needs: deploy-staging
    environment: production
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: app-${{ github.sha }}
          path: dist/
      - run: ./deploy.sh production dist/
        env:
          API_URL: ${{ vars.API_URL }}
```

---

## Environment Protection Rules

GitHub Environments support protection rules:

```
PROTECTION RULES

  Rule                        Effect
  -------------------------------------------------------
  Required reviewers          Someone must approve before
                              deploy proceeds

  Wait timer                  Mandatory delay (e.g., 15 min)
                              before deploy starts

  Branch restriction          Only main branch can deploy
                              to this environment

  Custom rules                GitHub Apps can enforce custom
                              deployment policies
```

```yaml
# In GitHub UI, configure production environment:
# - Required reviewers: team-lead, senior-dev
# - Wait timer: 5 minutes
# - Deployment branches: main only

# In workflow, the job pauses until approved:
deploy-production:
  needs: deploy-staging
  environment: production    # ← This triggers the protection rules
  runs-on: ubuntu-latest
  steps:
    - run: echo "This only runs after approval"
```

```
APPROVAL FLOW

  CI passes → Staging deployed → Staging verified
       |
       v
  GitHub shows: "Review pending for production"
       |
       v
  Reviewer checks staging
       |
       ├── Approves → Production deploy starts
       └── Rejects → Pipeline stops, team notified
```

---

## Preview Environments (Per-PR)

Preview environments give every PR its own temporary environment:

```
PREVIEW ENVIRONMENTS

  PR #42: feature/new-search
  → Deployed to: pr-42.preview.example.com

  PR #43: fix/login-bug
  → Deployed to: pr-43.preview.example.com

  PR #44: refactor/auth
  → Deployed to: pr-44.preview.example.com

  When PR is merged or closed → Preview environment destroyed
```

```yaml
# Preview environment for each PR
name: Preview

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  preview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run build

      - name: Deploy preview
        run: |
          PREVIEW_URL="pr-${{ github.event.pull_request.number }}.preview.example.com"
          ./deploy-preview.sh $PREVIEW_URL dist/
          echo "Preview deployed to https://$PREVIEW_URL"

      - name: Comment PR with preview URL
        uses: actions/github-script@v7
        with:
          script: |
            const prNumber = context.payload.pull_request.number;
            const url = `https://pr-${prNumber}.preview.example.com`;
            await github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: prNumber,
              body: `Preview deployed: ${url}`
            });
```

Services like Vercel, Netlify, and Railway create preview environments
automatically for every PR.

---

## Infrastructure as Code

Define your environments in code, not by clicking buttons:

```yaml
# infrastructure/staging.yml
environment: staging
region: us-east-1
instances:
  app:
    type: t3.medium
    count: 2
    image: app:latest
  database:
    type: db.t3.medium
    engine: postgres
    version: '16'
    storage: 50GB
  cache:
    type: cache.t3.micro
    engine: redis
    version: '7'
```

```yaml
# infrastructure/production.yml
environment: production
region: us-east-1
instances:
  app:
    type: t3.large       # ← bigger than staging
    count: 4             # ← more than staging
    image: app:latest
  database:
    type: db.r6g.large   # ← bigger than staging
    engine: postgres
    version: '16'
    storage: 500GB       # ← more than staging
    multi_az: true       # ← production only
  cache:
    type: cache.r6g.large
    engine: redis
    version: '7'
    cluster: true        # ← production only
```

The staging environment should be as similar to production as possible.
The differences should only be in scale (fewer/smaller instances), not
in architecture.

---

## Common Pitfalls

```
PITFALL                                FIX
---------------------------------------------------------------
Staging doesn't match production       Use same architecture, fewer
architecture                           resources

Rebuilding for each environment        Build once, configure per env

No approval gate for production        Add required reviewers

Preview envs never cleaned up          Auto-delete when PR closes

Different dependency versions          Pin versions, use lock files
per environment

Testing against dev data, not          Use anonymized production data
production-like data                   in staging
```

---

## Exercises

1. **Set up GitHub environments**: Create "staging" and "production"
   environments in a repository. Add different secrets to each.
   Verify the correct secret is used per environment.

2. **Promotion pipeline**: Create a workflow that deploys to staging
   automatically, then requires manual approval before production.

3. **Preview environments**: Set up a workflow that deploys a preview
   for each PR. Comment the URL on the PR.

4. **Same artifact, different config**: Create a build artifact in one
   job and deploy it to two different environments with different
   configurations.

5. **Environment comparison**: List every configuration difference
   between your dev and production environments. Is staging closer to
   dev or production? It should be closer to production.

---

[Next: Lesson 16 — Build a Pipeline Project](./16-build-pipeline-project.md)
