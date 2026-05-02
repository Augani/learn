# Lesson 17: Deployment

## The Big Analogy: Shipping a Product

```
DEPLOYMENT = SHIPPING A PRODUCT

  Vercel                Docker + VPS           Self-hosted K8s
  = Amazon FBA          = Own warehouse        = Own logistics company

  Ship it, they         You pack, you ship,    You build trucks,
  handle everything.    you rent a warehouse.  warehouses, routes.
  Pay per use.          More control.          Total control.
  Zero maintenance.     Some maintenance.      Heavy maintenance.

  Best for:             Best for:              Best for:
  Next.js apps          Custom stacks          Enterprise scale
  Fast iteration        Cost control           Multi-service
  Small teams           Specific requirements  Large teams
```

## Vercel Deployment

```
VERCEL DEPLOYMENT FLOW

  git push main
       |
       v
  +----------+
  | GitHub   |     Webhook triggers Vercel
  | Action   |
  +----+-----+
       |
       v
  +----------+
  | Build    |     next build
  | Step     |     Optimize, bundle, SSG
  +----+-----+
       |
       v
  +----+-----+
  | Deploy   |     Edge network (CDN)
  | to Edge  |     Serverless functions
  +----+-----+     Static assets
       |
       v
  Production URL
  + Preview URLs for PRs
```

```json
{
  "buildCommand": "next build",
  "outputDirectory": ".next",
  "installCommand": "npm ci",
  "framework": "nextjs",
  "regions": ["iad1", "sfo1"],
  "env": {
    "DATABASE_URL": "@database-url",
    "NEXTAUTH_SECRET": "@nextauth-secret"
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "no-store" }
      ]
    }
  ]
}
```

## Docker Deployment

```
DOCKER BUILD STAGES

  Stage 1: Dependencies        Stage 2: Build           Stage 3: Run
  +------------------+        +------------------+     +------------------+
  | FROM node:20     |        | FROM node:20     |     | FROM node:20-slim|
  | COPY package*    |        | COPY --from=deps |     | COPY --from=build|
  | RUN npm ci       |        | COPY src/        |     | Only production  |
  +------------------+        | RUN npm run build|     | files            |
                              +------------------+     +------------------+

  Multi-stage = smaller final image
  deps (500 MB) -> build (800 MB) -> runtime (150 MB)
```

```dockerfile
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production=false

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

### Docker Compose for Local Dev

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/myapp
      - REDIS_URL=redis://redis:6379
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: myapp
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

## CI/CD Pipeline

```
CI/CD FLOW

  Push to branch
       |
       v
  +----------+     Lint + Type Check
  | Validate |     npm run lint && tsc --noEmit
  +----+-----+
       |
       v
  +----------+     Vitest + Playwright
  |  Test    |
  +----+-----+
       |
       v
  +----------+     docker build + push
  |  Build   |
  +----+-----+
       |
       v
  +----------+     Staging first, then production
  | Deploy   |
  +----------+
```

```yaml
name: CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit
      - run: npm run test -- --reporter=verbose

  e2e:
    needs: validate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run build
      - run: npx playwright test
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/

  deploy:
    needs: [validate, e2e]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          push: true
          tags: ghcr.io/${{ github.repository }}:${{ github.sha }}

      - name: Deploy to production
        run: |
          curl -X POST "${{ secrets.DEPLOY_WEBHOOK }}" \
            -H "Authorization: Bearer ${{ secrets.DEPLOY_TOKEN }}" \
            -d '{"image": "ghcr.io/${{ github.repository }}:${{ github.sha }}"}'
```

## Environment Variables

```
ENV VAR STRATEGY

  +-------------------+------------------+------------------+
  | Variable          | Local (.env)     | Production       |
  +-------------------+------------------+------------------+
  | DATABASE_URL      | .env.local       | Platform secret  |
  | NEXTAUTH_SECRET   | .env.local       | Platform secret  |
  | NEXT_PUBLIC_URL   | .env.development | Platform env var |
  +-------------------+------------------+------------------+

  NEXT_PUBLIC_ prefix = exposed to browser (be careful!)
  No prefix = server-only (safe for secrets)
```

```typescript
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.string().url(),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

function validateEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error("Invalid environment variables:");
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables");
  }

  return parsed.data;
}

export const env = validateEnv();
```

## Health Checks

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const checks: Record<string, { status: string; latency?: number }> = {};

  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: "healthy", latency: Date.now() - dbStart };
  } catch {
    checks.database = { status: "unhealthy", latency: Date.now() - dbStart };
  }

  const allHealthy = Object.values(checks).every(
    (check) => check.status === "healthy"
  );

  return NextResponse.json(
    {
      status: allHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: allHealthy ? 200 : 503 }
  );
}
```

## Exercises

1. Write a multi-stage Dockerfile for a Next.js app that produces a standalone output under 200 MB. Test it locally with Docker Compose including Postgres and Redis.

2. Create a GitHub Actions CI/CD pipeline that: lints, type-checks, runs unit tests, runs E2E tests with Playwright, builds a Docker image, and deploys on merge to main.

3. Implement environment variable validation with Zod that fails at build time if required variables are missing. Include separate schemas for server and client variables.

4. Set up preview deployments: each PR gets its own URL with its own database (or uses a shared staging DB). Include a cleanup job when PRs are closed.

5. Create a health check endpoint that verifies database connectivity, Redis connectivity, and external API availability. Return proper status codes and latency metrics.

## Key Takeaways

```
+-------------------------------------------+
| DEPLOYMENT ESSENTIALS                     |
|                                           |
| 1. Vercel for fastest Next.js deploys    |
| 2. Docker for portable, reproducible     |
| 3. CI/CD: lint, test, build, deploy      |
| 4. Validate env vars at build time       |
| 5. Health checks for every service       |
| 6. Preview deploys for every PR          |
+-------------------------------------------+
```
