# Lesson 16: Capstone — Build a Complete CI/CD Pipeline

> **The one thing to remember**: This is where everything comes together.
> You're building a real pipeline from scratch — not following a
> tutorial, but engineering a system. By the end, you'll have automated
> testing, linting, building, and blue-green deployment that runs every
> time you push code.

---

## What We're Building

A full CI/CD pipeline for a Node.js web application. Here's the end
state:

```
THE COMPLETE PIPELINE

  Developer pushes code to feature branch
       |
       v
  +-----------------+
  |  PR Opened      |
  +-----------------+
       |
       +---> Lint (ESLint + Prettier)
       +---> Type Check (TypeScript)
       +---> Unit Tests (Vitest)
       +---> Build
       |
       v
  All checks pass? ──No──> PR blocked
       |
      Yes
       |
       v
  Code review + merge to main
       |
       v
  +-----------------+
  |  Main Pipeline  |
  +-----------------+
       |
       +---> Lint + Type Check + Test (parallel)
       |
       v
  Build production artifact
       |
       v
  Deploy to staging (auto)
       |
       v
  Smoke tests on staging
       |
       v
  Manual approval
       |
       v
  Blue-green deploy to production
       |
       v
  Post-deploy health check
       |
       v
  Monitor for 5 minutes
       |
       ├── Healthy → Done!
       └── Unhealthy → Auto-rollback
```

---

## Step 1: Project Setup

Create a simple Node.js/TypeScript web application:

```bash
mkdir pipeline-project && cd pipeline-project
git init
npm init -y

npm install express
npm install --save-dev \
  typescript \
  @types/express \
  @types/node \
  vitest \
  eslint \
  @eslint/js \
  typescript-eslint \
  prettier \
  husky \
  lint-staged
```

**tsconfig.json:**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**src/app.ts:**

```typescript
import express, { Request, Response } from 'express';

const app = express();

app.get('/', (_req: Request, res: Response) => {
  res.json({ message: 'Hello, Pipeline!', version: process.env.APP_VERSION || 'dev' });
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    version: process.env.APP_VERSION || 'dev',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

export default app;
```

**src/server.ts:**

```typescript
import app from './app';

const PORT = parseInt(process.env.PORT || '3000', 10);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

**src/math.ts** (something testable):

```typescript
export function add(a: number, b: number): number {
  return a + b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}

export function fibonacci(n: number): number {
  if (n < 0) throw new Error('Negative numbers not supported');
  if (n <= 1) return n;
  let prev = 0;
  let curr = 1;
  for (let i = 2; i <= n; i++) {
    const next = prev + curr;
    prev = curr;
    curr = next;
  }
  return curr;
}
```

---

## Step 2: Tests

**src/math.test.ts:**

```typescript
import { describe, it, expect } from 'vitest';
import { add, multiply, fibonacci } from './math';

describe('add', () => {
  it('adds two positive numbers', () => {
    expect(add(2, 3)).toBe(5);
  });

  it('handles negative numbers', () => {
    expect(add(-1, 1)).toBe(0);
  });

  it('handles zero', () => {
    expect(add(0, 0)).toBe(0);
  });
});

describe('multiply', () => {
  it('multiplies two numbers', () => {
    expect(multiply(3, 4)).toBe(12);
  });

  it('handles zero', () => {
    expect(multiply(5, 0)).toBe(0);
  });
});

describe('fibonacci', () => {
  it('returns 0 for n=0', () => {
    expect(fibonacci(0)).toBe(0);
  });

  it('returns 1 for n=1', () => {
    expect(fibonacci(1)).toBe(1);
  });

  it('returns 55 for n=10', () => {
    expect(fibonacci(10)).toBe(55);
  });

  it('throws for negative numbers', () => {
    expect(() => fibonacci(-1)).toThrow('Negative numbers not supported');
  });
});
```

**vitest.config.ts:**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
```

---

## Step 3: Linting and Formatting

**eslint.config.js:**

```javascript
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      'no-console': ['error', { allow: ['log', 'error', 'warn'] }],
      '@typescript-eslint/no-unused-vars': 'error',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**'],
  }
);
```

**.prettierrc:**

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

**package.json scripts:**

```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/server.js",
    "dev": "npx tsx watch src/server.ts",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "tsc --noEmit",
    "ci": "npm run format:check && npm run lint && npm run typecheck && npm run test && npm run build"
  },
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,yml}": ["prettier --write"]
  }
}
```

---

## Step 4: Git Hooks

```bash
npx husky init
echo "npx lint-staged" > .husky/pre-commit
echo "npm run typecheck" >> .husky/pre-commit
```

---

## Step 5: CI Workflow (PR Checks)

**.github/workflows/ci.yml:**

```yaml
name: CI

on:
  pull_request:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    name: Lint & Format
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run format:check
      - run: npm run lint

  typecheck:
    name: Type Check
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run typecheck

  test:
    name: Tests
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:coverage

  build:
    name: Build
    needs: [lint, typecheck, test]
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: dist-${{ github.sha }}
          path: dist/
          retention-days: 7
```

```
CI WORKFLOW EXECUTION

  PR opened/updated
       |
       +---> lint ──────────────┐
       |                        |
       +---> typecheck ─────────+──> build ──> upload artifact
       |                        |
       +---> test ──────────────┘

  Parallel jobs: ~2-3 minutes total
  Sequential with build: ~4-5 minutes total
```

---

## Step 6: CD Workflow (Deploy)

**.github/workflows/deploy.yml:**

```yaml
name: Deploy

on:
  push:
    branches: [main]

concurrency:
  group: deploy
  cancel-in-progress: false

jobs:
  ci:
    name: CI Checks
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run ci

  build:
    name: Build
    needs: ci
    runs-on: ubuntu-latest
    timeout-minutes: 10
    outputs:
      artifact-name: dist-${{ github.sha }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: dist-${{ github.sha }}
          path: dist/
          retention-days: 30

  deploy-staging:
    name: Deploy to Staging
    needs: build
    runs-on: ubuntu-latest
    environment: staging
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4

      - uses: actions/download-artifact@v4
        with:
          name: dist-${{ github.sha }}
          path: dist/

      - name: Deploy to staging
        run: |
          echo "Deploying to staging..."
          echo "Artifact contents:"
          ls -la dist/
          # Replace with your real deploy command:
          # scp -r dist/ user@staging-server:/app/
          # or: aws s3 sync dist/ s3://staging-bucket/
          # or: kubectl set image deployment/app app=myimage:${{ github.sha }}

      - name: Smoke test staging
        run: |
          echo "Running smoke tests against staging..."
          # Replace with real URL:
          # curl -f https://staging.example.com/health || exit 1
          # node scripts/smoke-test.js https://staging.example.com

  deploy-production:
    name: Deploy to Production
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4

      - uses: actions/download-artifact@v4
        with:
          name: dist-${{ github.sha }}
          path: dist/

      - name: Deploy to production (blue-green)
        run: |
          echo "Starting blue-green deployment..."
          # 1. Deploy to inactive environment
          # 2. Health check the new environment
          # 3. Switch traffic
          # Replace with your real deploy commands

      - name: Post-deploy health check
        run: |
          echo "Checking production health..."
          # curl -f https://example.com/health || exit 1

      - name: Monitor for 5 minutes
        run: |
          echo "Monitoring deployment for 5 minutes..."
          for i in $(seq 1 10); do
            echo "Health check $i/10..."
            # HEALTH=$(curl -s https://example.com/health)
            # ERROR_RATE=$(echo $HEALTH | jq -r '.errorRate // 0')
            # if (( $(echo "$ERROR_RATE > 0.05" | bc -l) )); then
            #   echo "Error rate too high! Rolling back..."
            #   ./scripts/rollback.sh
            #   exit 1
            # fi
            sleep 30
          done
          echo "Monitoring complete. Deployment successful!"
```

---

## Step 7: Dockerfile (for Blue-Green)

**Dockerfile:**

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:20-alpine

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/server.js"]
```

---

## Step 8: Branch Protection

Set up these rules on GitHub for the `main` branch:

```
BRANCH PROTECTION CONFIGURATION

  [x] Require pull request reviews before merging
      - Required approving reviews: 1

  [x] Require status checks to pass before merging
      - Required checks:
        - lint
        - typecheck
        - test
        - build

  [x] Require branches to be up to date before merging

  [x] Do not allow bypassing the above settings
```

---

## The Complete Picture

```
EVERYTHING TOGETHER

  Developer writes code
       |
  Pre-commit hook: lint-staged (format + lint)
       |
  Push to feature branch
       |
  PR created → CI workflow triggers
       |
       +---> lint (format + eslint)
       +---> typecheck (tsc --noEmit)
       +---> test (vitest + coverage)
       |
       v
  All pass + code review → merge to main
       |
  Deploy workflow triggers
       |
  CI checks (full suite)
       |
  Build → artifact uploaded
       |
  Deploy to staging (auto)
       |
  Smoke tests on staging
       |
  Manual approval (production environment)
       |
  Blue-green deploy to production
       |
  Health checks + 5-minute monitoring
       |
  Success! (or auto-rollback on failure)
```

---

## Project Checklist

Use this checklist to verify you've built everything:

```
PROJECT COMPLETENESS CHECKLIST

  Source Code:
  [ ] TypeScript project with strict mode
  [ ] Express app with / and /health endpoints
  [ ] Testable module (math.ts or similar)

  Quality:
  [ ] ESLint configured and passing
  [ ] Prettier configured and passing
  [ ] TypeScript type checking passing
  [ ] All tests passing with >80% coverage

  Git Hooks:
  [ ] Husky installed
  [ ] Pre-commit: lint-staged (format + lint)
  [ ] lint-staged configured in package.json

  CI (PR checks):
  [ ] .github/workflows/ci.yml created
  [ ] Lint job
  [ ] Type check job
  [ ] Test job
  [ ] Build job (depends on lint, typecheck, test)
  [ ] Artifact uploaded

  CD (Deploy):
  [ ] .github/workflows/deploy.yml created
  [ ] CI checks on main push
  [ ] Build and upload artifact
  [ ] Deploy to staging (auto)
  [ ] Smoke tests on staging
  [ ] Deploy to production (manual approval)
  [ ] Post-deploy health check
  [ ] Monitoring period

  Branch Protection:
  [ ] PR required for main
  [ ] Status checks required
  [ ] At least 1 reviewer required

  Docker (optional):
  [ ] Dockerfile with multi-stage build
  [ ] HEALTHCHECK directive
  [ ] docker-compose.yml for local development
```

---

## Exercises

1. **Build the full pipeline**: Follow this lesson from start to
   finish. Create the project, configure all tools, create both
   workflows, set up branch protection. Push to GitHub and verify
   everything works end-to-end.

2. **Break it**: Deliberately introduce a lint error, a type error,
   and a test failure. Verify each gate catches its corresponding
   issue. Verify PRs are blocked.

3. **Extend it**: Add a matrix build that tests on Node 18 and 20.
   Add a code coverage badge to your README.

4. **Real deployment**: If you have a server (even a free-tier VPS),
   replace the echo commands in the deploy steps with real deployment
   commands. Deploy your app for real.

5. **Monitoring**: After deploying, set up a simple uptime monitor
   (UptimeRobot, Freshping, or similar free service) that pings your
   `/health` endpoint every 5 minutes.

---

## Congratulations!

You've built a complete CI/CD pipeline from scratch. Every concept from
this course — version control workflows, git hooks, GitHub Actions,
build automation, testing, linting, caching, secrets, deployment
strategies, feature flags, monitoring, and multi-environment pipelines
— comes together in this one system.

The pipeline you've built is production-grade. Real companies ship
software this way. Now go automate everything.

---

[Back to Roadmap](./00-roadmap.md)
