# Lesson 10: Environment Variables & Secrets

> **The one thing to remember**: Secrets in code are like hiding your
> house key under the doormat. Everyone knows to look there. Environment
> variables and secret managers are like giving keys only to people who
> need them, and changing the locks regularly. Never, ever put a
> password, API key, or token directly in your code.

---

## The House Key Analogy

```
BAD: Key under the doormat (hardcoded secret)

  // config.js
  const API_KEY = "sk-abc123xyz789";   ← Everyone who sees this file
  const DB_PASSWORD = "supersecret";   ← has your keys. Forever.
                                       ← Even after you "delete" it,
                                       ← Git history remembers.

GOOD: Key in a secure lockbox (environment variable)

  // config.js
  const API_KEY = process.env.API_KEY;      ← Code doesn't know the key
  const DB_PASSWORD = process.env.DB_PASS;  ← Key is injected at runtime
                                            ← Different key per environment
                                            ← Rotatable without code change
```

---

## Why Hardcoding Secrets Is Catastrophic

```
WHAT HAPPENS WHEN YOU COMMIT A SECRET

  Day 1: Developer commits API key in source code
         "I'll remove it later"

  Day 2: Code is pushed to GitHub (public repo)

  Day 3: Automated bots scan GitHub for leaked keys
         (yes, this really happens, within MINUTES)

  Day 4: Bot uses your AWS key to spin up 50 crypto miners
         Your bill: $10,000+

  Day 5: You delete the key from the file

  Day 6: Key is STILL in Git history (git log -p)
         Still compromised. Must rotate the key.
```

```
REAL COSTS OF LEAKED SECRETS

  Secret Type         What Happens
  ---------------------------------------------------------
  AWS access key      Crypto mining, $1,000s in compute
  Database password   Data breach, legal liability
  API keys            Service abuse, rate limiting, bills
  SSH private key     Full server access, lateral movement
  OAuth tokens        Account takeover
  Stripe/payment key  Financial fraud

  All of these have happened to real companies.
  Multiple times.
```

---

## Environment Variables: The Basics

An environment variable is a key-value pair set outside your code,
available at runtime:

```bash
# Setting an environment variable (Unix/macOS/Linux)
export DATABASE_URL="postgres://user:pass@host:5432/mydb"
export API_KEY="sk-abc123"
export NODE_ENV="production"

# Reading it in your code
# Node.js
process.env.DATABASE_URL

# Python
os.environ["DATABASE_URL"]

# Rust
std::env::var("DATABASE_URL")

# Go
os.Getenv("DATABASE_URL")
```

```
HOW ENVIRONMENT VARIABLES WORK

  Operating System
  +----------------------------------------+
  | Environment Variables:                  |
  |   DATABASE_URL = "postgres://..."       |
  |   API_KEY = "sk-abc123"                |
  |   NODE_ENV = "production"              |
  +----------------------------------------+
         |
         v
  Your Application
  +----------------------------------------+
  | process.env.DATABASE_URL               |
  |   → "postgres://..."                   |
  | process.env.API_KEY                    |
  |   → "sk-abc123"                        |
  +----------------------------------------+

  The app doesn't know WHERE the values come from.
  They could be set by:
    - CI/CD pipeline
    - Docker
    - Cloud platform (Heroku, Vercel, AWS)
    - A .env file (for local development only)
```

---

## .env Files for Local Development

`.env` files store environment variables locally. NEVER commit them.

```bash
# .env (LOCAL ONLY — in .gitignore!)
DATABASE_URL=postgres://localhost:5432/myapp_dev
API_KEY=sk-test-key-for-development
REDIS_URL=redis://localhost:6379
LOG_LEVEL=debug
```

```bash
# .env.example (COMMITTED — shows what's needed without values)
DATABASE_URL=
API_KEY=
REDIS_URL=
LOG_LEVEL=
```

```
.env FILE RULES

  .env            → In .gitignore, NEVER committed. Has real values.
  .env.example    → Committed. Documents required variables. No values.
  .env.test       → In .gitignore. Test-specific values.
  .env.production → DOES NOT EXIST. Production uses real env vars.
```

Your `.gitignore` must include:

```
# .gitignore
.env
.env.local
.env.*.local
```

**Loading .env files in code:**

```javascript
// Node.js: dotenv package
import 'dotenv/config';
console.log(process.env.DATABASE_URL);
```

```python
# Python: python-dotenv
from dotenv import load_dotenv
import os

load_dotenv()
print(os.environ["DATABASE_URL"])
```

---

## Secrets in GitHub Actions

GitHub Actions has built-in secret management:

### Setting Secrets

1. Go to Repository → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `DATABASE_URL`, Value: `postgres://prod:password@host/db`

### Using Secrets in Workflows

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy
        run: ./deploy.sh
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          API_KEY: ${{ secrets.API_KEY }}
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

```
HOW GITHUB SECRETS WORK

  1. You store secret in GitHub (encrypted at rest)
  2. Workflow references ${{ secrets.NAME }}
  3. GitHub injects the value at runtime
  4. The value is MASKED in logs (shows ***)
  5. Secrets are NOT passed to workflows from forks
     (prevents malicious PRs from stealing secrets)

  +------------------+         +-------------------+
  | GitHub Secrets   |         | Workflow Runner   |
  | (encrypted)      |         |                   |
  |                  |-------->| env:              |
  | DATABASE_URL:    |         |   DATABASE_URL=.. |
  | "postgres://..." |         |                   |
  | API_KEY:         |         | Logs show:        |
  | "sk-abc123"      |         |   "Using ***"     |
  +------------------+         +-------------------+
```

### Secret Scopes

```
SECRET SCOPES

  Level              Access                    Use Case
  ---------------------------------------------------------------
  Repository secret  One repo only             Most common
  Environment secret Specific environment      Different per env
                     (staging vs production)
  Organization       All repos in org          Shared credentials
  secret             (or selected repos)
```

### Environment Secrets

```yaml
jobs:
  deploy-staging:
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - run: echo "Deploying to ${{ vars.DEPLOY_URL }}"
        env:
          API_KEY: ${{ secrets.API_KEY }}

  deploy-production:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - run: echo "Deploying to ${{ vars.DEPLOY_URL }}"
        env:
          API_KEY: ${{ secrets.API_KEY }}
```

Each environment can have different values for the same secret name.
The staging API_KEY is different from the production API_KEY.

---

## Secret Management Beyond GitHub

For larger teams, dedicated secret managers provide more features:

```
SECRET MANAGEMENT TOOLS

  Tool                  Provider    Features
  -----------------------------------------------------------
  GitHub Secrets        GitHub      Free, integrated, basic
  HashiCorp Vault       Self-host   Dynamic secrets, rotation,
                                    audit logs, policies
  AWS Secrets Manager   AWS         Auto-rotation, IAM integration
  GCP Secret Manager    GCP         IAM integration, versioning
  Azure Key Vault       Azure       HSM-backed, audit logs
  1Password (CI)        1Password   Team secret sharing
  Doppler              SaaS         Multi-environment, sync
```

### HashiCorp Vault Integration

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Import secrets from Vault
        uses: hashicorp/vault-action@v3
        with:
          url: https://vault.example.com
          method: jwt
          role: github-actions
          secrets: |
            secret/data/production database_url | DATABASE_URL ;
            secret/data/production api_key | API_KEY ;

      - name: Deploy
        run: ./deploy.sh
        env:
          DATABASE_URL: ${{ env.DATABASE_URL }}
          API_KEY: ${{ env.API_KEY }}
```

```
VAULT DYNAMIC SECRETS

  Traditional:                      Vault Dynamic:
  One database password             Vault creates a TEMPORARY
  shared by all services            username/password for each
  Never changes                     deployment

  Risk: One leak exposes            Risk: Leaked credential
  everything forever                expires in 1 hour

  +----------+                      +----------+
  | App      |                      | App      |
  | pw: abc  |--- same password --> | pw: tmp1 |--- unique, expires
  +----------+    everywhere        +----------+    in 1 hour
  +----------+                      +----------+
  | App      |                      | App      |
  | pw: abc  |                      | pw: tmp2 |--- different, expires
  +----------+                      +----------+    in 1 hour
```

---

## Secret Rotation

Secrets should be rotated (changed) regularly:

```
SECRET ROTATION SCHEDULE

  Secret Type              Rotation Frequency
  -----------------------------------------------
  API keys                 Every 90 days
  Database passwords       Every 90 days
  SSH keys                 Every 6-12 months
  Service account tokens   Every 30-90 days
  OAuth client secrets     Every 6-12 months
  Encryption keys          Every 12 months

  After a suspected breach: IMMEDIATELY rotate ALL secrets
```

---

## Common Mistakes and Fixes

```
MISTAKE                                FIX
---------------------------------------------------------------
Hardcode secret in source code         Use environment variables
Commit .env file                       Add .env to .gitignore
Use same secret for all environments   Different secrets per environment
Log secret values for debugging        Mask in logs, never print
Pass secrets in URL parameters         Use headers or env vars
Share secrets over Slack/email          Use a secret manager
Never rotate secrets                   Set rotation schedule
Use secrets in PR workflows from       GitHub blocks this by default
forks (security risk)                  for good reason
```

### Checking for Accidental Secret Commits

```bash
# Search Git history for potential secrets
git log -p | grep -i "password\|secret\|api_key\|token" | head -20
```

Better yet, use automated tools:

```yaml
# .github/workflows/security.yml
name: Secret Scanning

on: [push, pull_request]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Scan for secrets
        uses: trufflesecurity/trufflehog@main
        with:
          extra_args: --only-verified
```

---

## Validating Environment Variables

Don't let your app start with missing environment variables. Fail fast:

```typescript
// config.ts — validate at startup
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  databaseUrl: requireEnv('DATABASE_URL'),
  apiKey: requireEnv('API_KEY'),
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
};
```

```python
# config.py
import os
import sys

REQUIRED_VARS = ['DATABASE_URL', 'API_KEY', 'SECRET_KEY']

missing = [var for var in REQUIRED_VARS if not os.environ.get(var)]
if missing:
    print(f"Missing required environment variables: {', '.join(missing)}")
    sys.exit(1)
```

---

## Exercises

1. **Create a .env setup**: Add a `.env.example` file to a project
   listing all required variables. Add `.env` to `.gitignore`. Create
   a `.env` file locally with test values.

2. **Use GitHub Secrets**: Store a secret in GitHub. Create a workflow
   that uses it. Verify the value is masked in logs (try to echo it).

3. **Validate on startup**: Write a config module that validates all
   required environment variables at startup. Remove one variable and
   verify the app refuses to start with a clear error message.

4. **Scan for secrets**: Run trufflehog or gitleaks on a repository
   you own. Were any secrets accidentally committed?

5. **Environment-specific secrets**: Create two GitHub environments
   (staging and production) with different values for the same secret
   name. Verify the correct value is used in each.

---

[Next: Lesson 11 — Blue-Green Deployment](./11-deployment-blue-green.md)
