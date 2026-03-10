# Lesson 11: Blue-Green Deployment

> **The one thing to remember**: Blue-green deployment is like having
> two identical stages at a concert. While the audience watches the
> band on the Blue stage, roadies set up the next act on the Green
> stage behind a curtain. When the new act is ready and sound-checked,
> you just swing the spotlight. Instant switch, no awkward silence.

---

## The Concert Stage Analogy

```
TRADITIONAL DEPLOYMENT (One Stage)

  Band A playing for audience
       |
  "Hey everyone, we need to stop the music for 20 minutes
   while we set up Band B"
       |
  Audience waits (DOWNTIME)
       |
  Band B starts playing
       |
  Band B messes up → "Uh... bring Band A back?"
  (But Band A's equipment is already torn down)


BLUE-GREEN DEPLOYMENT (Two Stages)

  BLUE STAGE: Band A playing ←── Spotlight (live traffic)
  GREEN STAGE: Setting up Band B (no audience sees this)
       |
  Sound check Band B on Green Stage (test in production-like env)
       |
  Swing spotlight to Green Stage ←── Band B now live
  (ZERO downtime, instant switch)
       |
  Band B messes up? → Swing spotlight back to Blue
  (Band A is still set up and ready!)
```

---

## How Blue-Green Works

You maintain two identical production environments:

```
BLUE-GREEN ARCHITECTURE

                    +------------------+
  Users ──────────> |   Load Balancer  |
                    |   / Router       |
                    +--------+---------+
                             |
              +--------------+--------------+
              |                             |
              v                             v
     +----------------+           +----------------+
     |  BLUE (v1.0)   |           | GREEN (v2.0)   |
     |                |           |                |
     | App Server     |           | App Server     |
     | Database (v1)  |           | Database (v2)  |
     | Config (v1)    |           | Config (v2)    |
     |                |           |                |
     | STATUS: LIVE   |           | STATUS: IDLE   |
     +----------------+           +----------------+

  Step 1: Blue is live, Green is idle
  Step 2: Deploy v2.0 to Green
  Step 3: Test Green thoroughly
  Step 4: Switch load balancer to Green
  Step 5: Green is now live, Blue is idle
  Step 6: If problems → switch back to Blue (instant rollback)
```

---

## The Deployment Process Step by Step

```
BLUE-GREEN DEPLOYMENT TIMELINE

  Time    Blue (v1.0)        Green               Users See
  ----    ---------------    ----------------    -----------
  T+0     LIVE               Idle                v1.0
  T+1     LIVE               Deploying v2.0      v1.0
  T+2     LIVE               Running tests       v1.0
  T+3     LIVE               Health checks OK    v1.0
  T+4     Idle               LIVE                v2.0  ← switch!
  T+5     Standing by        LIVE                v2.0
          (rollback ready)

  If v2.0 has problems at T+5:
  T+6     LIVE               Idle                v1.0  ← rollback!

  Total downtime: ZERO
  Rollback time: seconds (just switch the router)
```

---

## Implementing Blue-Green with Docker and Nginx

### The Setup

```
PROJECT STRUCTURE

  blue-green/
  ├── docker-compose.yml
  ├── nginx/
  │   └── nginx.conf
  ├── app/
  │   ├── Dockerfile
  │   └── server.js
  └── deploy.sh
```

### The Application

```javascript
// app/server.js
const http = require('http');

const VERSION = process.env.APP_VERSION || 'unknown';
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'healthy', version: VERSION }));
    return;
  }

  res.writeHead(200);
  res.end(`Hello from version ${VERSION}\n`);
});

server.listen(PORT, () => {
  console.log(`Server v${VERSION} running on port ${PORT}`);
});
```

### Nginx as the Router

```nginx
# nginx/nginx.conf
upstream app {
    # This file gets rewritten by deploy.sh
    # to point to either blue or green
    server blue:3000;
}

server {
    listen 80;

    location / {
        proxy_pass http://app;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /health {
        proxy_pass http://app;
    }
}
```

### Docker Compose

```yaml
# docker-compose.yml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf
    depends_on:
      - blue
      - green

  blue:
    build: ./app
    environment:
      - APP_VERSION=1.0.0
      - PORT=3000

  green:
    build: ./app
    environment:
      - APP_VERSION=1.0.0
      - PORT=3000
```

### The Deploy Script

```bash
#!/bin/bash
# deploy.sh — Blue-Green deployment

set -euo pipefail

NEW_VERSION=$1
HEALTH_CHECK_URL="http://localhost"
HEALTH_RETRIES=10
HEALTH_INTERVAL=2

current_env() {
    grep -o 'blue\|green' nginx/nginx.conf | head -1
}

switch_to() {
    local target=$1
    sed -i "s/server blue:3000/server ${target}:3000/" nginx/nginx.conf
    sed -i "s/server green:3000/server ${target}:3000/" nginx/nginx.conf
    docker compose exec nginx nginx -s reload
}

CURRENT=$(current_env)
if [ "$CURRENT" = "blue" ]; then
    TARGET="green"
else
    TARGET="blue"
fi

echo "Current: $CURRENT | Deploying to: $TARGET"

echo "Step 1: Deploy $NEW_VERSION to $TARGET"
APP_VERSION=$NEW_VERSION docker compose up -d $TARGET

echo "Step 2: Wait for $TARGET to be healthy"
for i in $(seq 1 $HEALTH_RETRIES); do
    HEALTH=$(docker compose exec $TARGET curl -s http://localhost:3000/health 2>/dev/null || echo "")
    if echo "$HEALTH" | grep -q "healthy"; then
        echo "  Health check passed on attempt $i"
        break
    fi
    if [ $i -eq $HEALTH_RETRIES ]; then
        echo "  Health check FAILED after $HEALTH_RETRIES attempts"
        echo "  Aborting deployment. $CURRENT remains live."
        exit 1
    fi
    echo "  Attempt $i/$HEALTH_RETRIES: waiting..."
    sleep $HEALTH_INTERVAL
done

echo "Step 3: Switch traffic to $TARGET"
switch_to $TARGET

echo "Step 4: Verify live traffic"
LIVE_VERSION=$(curl -s $HEALTH_CHECK_URL/health | grep -o '"version":"[^"]*"')
echo "  Live version: $LIVE_VERSION"

echo "Deployment complete! $TARGET is now live with $NEW_VERSION"
echo "Rollback command: ./deploy.sh $(docker compose exec $CURRENT printenv APP_VERSION)"
```

```
DEPLOY SCRIPT FLOW

  ./deploy.sh 2.0.0
       |
       v
  Detect current: Blue is live
  Target: Green
       |
       v
  Deploy v2.0.0 to Green container
       |
       v
  Health check Green (retry up to 10 times)
       |
       ├── Healthy → Continue
       └── Unhealthy → ABORT (Blue stays live)
               |
               v
  Switch Nginx from Blue to Green
       |
       v
  Verify live traffic serves v2.0.0
       |
       v
  Done! Green is live. Blue is rollback-ready.
```

---

## Blue-Green in Cloud Platforms

### AWS with Elastic Beanstalk

```yaml
# GitHub Actions: Blue-Green on AWS
- name: Deploy to Elastic Beanstalk
  uses: einaregilsson/beanstalk-deploy@v22
  with:
    aws_access_key: ${{ secrets.AWS_ACCESS_KEY_ID }}
    aws_secret_key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    application_name: my-app
    environment_name: my-app-green
    version_label: ${{ github.sha }}
    region: us-east-1

- name: Swap environment URLs
  run: |
    aws elasticbeanstalk swap-environment-cnames \
      --source-environment-name my-app-blue \
      --destination-environment-name my-app-green
```

### Cloudflare Workers (DNS-based switch)

```
DNS-BASED BLUE-GREEN

  app.example.com → CNAME → blue.app.example.com (current)

  Deploy to green.app.example.com
  Test green.app.example.com
  Update DNS: app.example.com → green.app.example.com

  Note: DNS propagation can take minutes.
  Use low TTL (60 seconds) for faster switches.
```

---

## The Database Problem

The hardest part of blue-green deployment is the database. Both
environments often share one database:

```
THE DATABASE CHALLENGE

  BLUE (v1.0)  ──┐
                  ├──→  Shared Database
  GREEN (v2.0) ──┘

  Problem: If v2.0 changes the database schema,
  v1.0 can't use the new schema (rollback breaks).
```

**Solutions:**

```
DATABASE MIGRATION STRATEGIES

  1. BACKWARD-COMPATIBLE MIGRATIONS
     - Add columns, don't remove them
     - Add tables, don't rename them
     - Deprecate first, remove in next release

     v1.0 schema: users (id, name, email)
     v2.0 schema: users (id, name, email, phone)  ← column ADDED
     v1.0 can still read (ignores phone column)
     Rollback safe!

  2. EXPAND-CONTRACT PATTERN
     Step 1 (expand):  Add new column, keep old column
     Step 2 (migrate): Copy data from old to new
     Step 3 (switch):  App uses new column
     Step 4 (contract): Remove old column (next release)

  3. SEPARATE DATABASES
     Blue has its own database
     Green has its own database
     Data synced between them
     (Complex but safest for rollback)
```

---

## Rollback Strategies

```
ROLLBACK DECISION TREE

  Deployment complete
       |
       v
  Monitor for 5-15 minutes
       |
       ├── Error rate > 1% → ROLLBACK
       ├── Latency > 2x normal → ROLLBACK
       ├── Health check fails → ROLLBACK
       └── All good → Keep new version
              |
              v
  ROLLBACK PROCESS:
  1. Switch load balancer back to old environment (seconds)
  2. Investigate the issue on the inactive environment
  3. Fix and redeploy
  4. No user impact if caught quickly
```

```
ROLLBACK SPEED COMPARISON

  Strategy                     Rollback Time
  -----------------------------------------------
  Blue-Green (switch LB)       Seconds
  Redeploy previous version    5-15 minutes
  Restore from backup          30-60 minutes
  Fix forward (write new code) Hours

  Blue-green wins by a massive margin.
```

---

## When to Use Blue-Green

```
GOOD FIT                             POOR FIT
-----------------------------------------------
Web applications                     Mobile apps (can't control user devices)
Stateless services                   Stateful services with local storage
Teams that deploy frequently         Very infrequent deployments
When zero downtime is required       When brief downtime is acceptable
When fast rollback is critical       When you have limited infrastructure

COST: You need 2x the infrastructure (while both are running)
BENEFIT: Zero downtime + instant rollback
```

---

## Exercises

1. **Mental model**: Draw the blue-green architecture for your current
   project. What serves as the "router"? What are the two environments?

2. **Docker blue-green**: Build the example from this lesson. Deploy
   v1.0, then v2.0, then rollback to v1.0. Practice until it's
   comfortable.

3. **Database migration**: Write a database migration that adds a
   column. Verify that the old app version still works with the new
   schema (backward compatible).

4. **Health check**: Implement a `/health` endpoint in any application.
   Include version number, uptime, and database connectivity status.

---

[Next: Lesson 12 — Canary & Rolling Deployments](./12-canary-rolling.md)
