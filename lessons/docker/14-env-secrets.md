# Environment Variables, Secrets, and Config

## The Label vs Safe Analogy

- **ENV** (environment variables) is like a label on a box. Anyone who can see the box can read the label. They're visible in `docker inspect`, process listings, and image history. Convenient, but not secret.

- **Secrets** are like a locked safe. Only authorized processes can open it, the combination isn't written anywhere visible, and the contents are encrypted at rest. You need the right key (service assignment in Swarm, mount in BuildKit) to access them.

The distinction matters because putting a database password in an environment variable is like writing your bank PIN on a sticky note attached to your debit card.

---

## ENV in Dockerfile

The `ENV` instruction sets an environment variable that persists in the image and every container created from it.

```dockerfile
FROM node:20-alpine

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app
COPY . .
RUN npm ci --production

CMD ["node", "server.js"]
```

These variables are baked into the image:

```bash
docker build -t myapp .
docker inspect myapp | grep -A 10 Env
```

```json
"Env": [
    "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
    "NODE_ENV=production",
    "PORT=3000"
]
```

Anyone who pulls this image can see these values. That's fine for `NODE_ENV` and `PORT`. It's catastrophic for `DATABASE_PASSWORD`.

### ARG vs ENV

`ARG` is available only during build time. `ENV` persists into the running container.

```dockerfile
ARG GO_VERSION=1.22
FROM golang:${GO_VERSION}-alpine

ARG BUILD_HASH
ENV APP_VERSION=${BUILD_HASH}

WORKDIR /app
COPY . .
RUN go build -ldflags "-X main.version=${BUILD_HASH}" -o /server .

CMD ["/server"]
```

```bash
docker build --build-arg BUILD_HASH=$(git rev-parse --short HEAD) -t myapp .
```

`GO_VERSION` is used during build (selecting the base image) and then gone. `BUILD_HASH` is passed as an ARG and copied to ENV so the running container knows its version.

Important: ARG values are visible in image history too:

```bash
docker history myapp
```

```
IMAGE          CREATED BY                                      SIZE
abc123         ARG BUILD_HASH=a3f7b2c                          0B
```

Never pass secrets as build ARGs. Use BuildKit secret mounts instead.

---

## Environment in Docker Compose

### Inline Environment

```yaml
services:
  api:
    build: ./api
    environment:
      DB_HOST: postgres
      DB_PORT: "5432"
      DB_USER: myapp
      DB_NAME: myapp
      LOG_LEVEL: info
```

### Variable Substitution from Host

```yaml
services:
  api:
    environment:
      DB_PASSWORD: ${DB_PASSWORD}
      API_KEY: ${API_KEY:?API_KEY must be set}
```

Compose reads from the host environment or `.env` file. The `:?` syntax causes Compose to fail with an error if the variable isn't set.

### env_file

Load variables from a file:

```yaml
services:
  api:
    env_file:
      - .env
      - .env.api
    environment:
      LOG_LEVEL: debug
```

Values in `environment` override values from `env_file`. Order matters — later files override earlier ones.

```
# .env.api
DB_HOST=postgres
DB_PORT=5432
DB_USER=myapp
DB_NAME=myapp
DB_PASSWORD=devpassword
REDIS_HOST=redis
REDIS_PORT=6379
```

### Precedence Order

From highest to lowest priority:

1. `environment` in compose file (explicit values)
2. Shell environment variables (exported on host)
3. `env_file` values
4. `ENV` in Dockerfile

This means you can override Dockerfile defaults at runtime without rebuilding:

```dockerfile
ENV LOG_LEVEL=info
```

```yaml
services:
  api:
    environment:
      LOG_LEVEL: debug
```

The container gets `LOG_LEVEL=debug`.

---

## The .env File

The `.env` file is read by Compose for variable substitution in the compose file itself. It's NOT automatically loaded into containers.

```
# .env
COMPOSE_PROJECT_NAME=myapp
POSTGRES_PASSWORD=devpassword
API_VERSION=1.5.0
```

```yaml
services:
  api:
    image: myregistry.com/api:${API_VERSION}
    environment:
      DB_PASSWORD: ${POSTGRES_PASSWORD}
```

Compose substitutes `${API_VERSION}` and `${POSTGRES_PASSWORD}` from `.env`.

### .env Best Practices

```
# .env.example (committed to git)
COMPOSE_PROJECT_NAME=myapp
POSTGRES_PASSWORD=
API_VERSION=latest
API_KEY=

# .env (in .gitignore, never committed)
COMPOSE_PROJECT_NAME=myapp
POSTGRES_PASSWORD=realpassword123
API_VERSION=1.5.0
API_KEY=sk-prod-abc123
```

Your `.gitignore`:

```
.env
.env.local
.env.*.local
!.env.example
```

Every new developer copies `.env.example` to `.env` and fills in their values.

---

## 12-Factor App Configuration

The 12-factor methodology says: store config in the environment. Not in code, not in config files baked into the image, not in a properties file.

This matters because the same image should run in development, staging, and production with different configuration.

```go
package config

import (
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	Port        int
	DatabaseURL string
	RedisURL    string
	LogLevel    string
	Environment string
}

func Load() (*Config, error) {
	port, err := strconv.Atoi(envOrDefault("PORT", "8080"))
	if err != nil {
		return nil, fmt.Errorf("invalid PORT: %w", err)
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}

	return &Config{
		Port:        port,
		DatabaseURL: dbURL,
		RedisURL:    envOrDefault("REDIS_URL", "redis://localhost:6379"),
		LogLevel:    envOrDefault("LOG_LEVEL", "info"),
		Environment: envOrDefault("ENVIRONMENT", "development"),
	}, nil
}

func envOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
```

TypeScript equivalent:

```typescript
interface Config {
  port: number;
  databaseUrl: string;
  redisUrl: string;
  logLevel: string;
  environment: string;
}

function loadConfig(): Config {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const port = parseInt(process.env.PORT ?? "3000", 10);
  if (isNaN(port)) {
    throw new Error("PORT must be a number");
  }

  return {
    port,
    databaseUrl,
    redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
    logLevel: process.env.LOG_LEVEL ?? "info",
    environment: process.env.ENVIRONMENT ?? "development",
  };
}
```

The pattern: require critical variables (fail fast), provide sensible defaults for optional ones.

---

## Docker Secrets (Swarm Mode)

Docker Secrets provide encrypted secret management for Swarm services. Secrets are encrypted at rest, transmitted only to nodes that need them, and mounted as files in containers.

### Creating Secrets

```bash
docker swarm init

echo "supersecretpassword" | docker secret create db_password -

docker secret create api_key ./api-key.txt

printf "myapp:supersecretpassword@postgres:5432/myapp" | docker secret create database_url -
```

### Using Secrets in Services

```bash
docker service create \
  --name api \
  --secret db_password \
  --secret api_key \
  myapp-api:latest
```

Inside the container, secrets appear as files at `/run/secrets/`:

```bash
cat /run/secrets/db_password
# supersecretpassword

cat /run/secrets/api_key
# sk-prod-abc123
```

### Reading Secrets in Application Code

Go:

```go
func readSecret(name string) (string, error) {
	path := fmt.Sprintf("/run/secrets/%s", name)
	data, err := os.ReadFile(path)
	if err != nil {
		envKey := strings.ToUpper(name)
		if v := os.Getenv(envKey); v != "" {
			return v, nil
		}
		return "", fmt.Errorf("secret %s not found in file or environment: %w", name, err)
	}
	return strings.TrimSpace(string(data)), nil
}
```

TypeScript:

```typescript
import { readFileSync, existsSync } from "node:fs";

function readSecret(name: string): string {
  const secretPath = `/run/secrets/${name}`;

  if (existsSync(secretPath)) {
    return readFileSync(secretPath, "utf-8").trim();
  }

  const envValue = process.env[name.toUpperCase()];
  if (envValue) {
    return envValue;
  }

  throw new Error(`Secret ${name} not found in /run/secrets or environment`);
}
```

This pattern tries the secret file first, falls back to environment variables. In production (Swarm), secrets come from files. In development, they come from environment variables.

### Secrets in Docker Compose

Compose supports secrets syntax, though without Swarm they're just bind-mounted files:

```yaml
services:
  api:
    build: ./api
    secrets:
      - db_password
      - api_key
    environment:
      DB_PASSWORD_FILE: /run/secrets/db_password

  postgres:
    image: postgres:16-alpine
    secrets:
      - db_password
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password

secrets:
  db_password:
    file: ./secrets/db_password.txt
  api_key:
    file: ./secrets/api_key.txt
```

Many official images support the `_FILE` suffix convention. `POSTGRES_PASSWORD_FILE` tells the PostgreSQL image to read the password from a file instead of the environment.

---

## Build-Time Secrets with BuildKit

Sometimes you need secrets during the build — like an npm token for private packages or a GitHub token for private Go modules.

### The Wrong Way

```dockerfile
# NEVER DO THIS
ARG NPM_TOKEN
RUN echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc
RUN npm install
RUN rm .npmrc
```

The `rm` doesn't help. The secret is permanently stored in the layer where it was written. Anyone can extract it from the image.

### The Right Way: BuildKit Secret Mounts

```dockerfile
# syntax=docker/dockerfile:1
FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./

RUN --mount=type=secret,id=npmrc,target=/app/.npmrc \
    npm ci --production

COPY . .
CMD ["node", "server.js"]
```

```bash
docker build --secret id=npmrc,src=$HOME/.npmrc -t myapp .
```

The `.npmrc` file is available ONLY during that specific `RUN` instruction. It's never written to any layer.

### Go Private Modules

```dockerfile
# syntax=docker/dockerfile:1
FROM golang:1.22-alpine AS builder
WORKDIR /app

RUN apk add --no-cache git

COPY go.mod go.sum ./

RUN --mount=type=secret,id=gitconfig,target=/root/.gitconfig \
    --mount=type=secret,id=netrc,target=/root/.netrc \
    go mod download

COPY . .
RUN CGO_ENABLED=0 go build -o /server .

FROM scratch
COPY --from=builder /server /server
ENTRYPOINT ["/server"]
```

```bash
docker build \
  --secret id=gitconfig,src=$HOME/.gitconfig \
  --secret id=netrc,src=$HOME/.netrc \
  -t myapp .
```

### SSH Agent Forwarding

For private Git repos accessed via SSH:

```dockerfile
# syntax=docker/dockerfile:1
FROM golang:1.22-alpine AS builder
RUN apk add --no-cache git openssh-client

RUN mkdir -p -m 0700 ~/.ssh && ssh-keyscan github.com >> ~/.ssh/known_hosts

RUN --mount=type=ssh go mod download
```

```bash
docker build --ssh default -t myapp .
```

Docker forwards your local SSH agent into the build. No keys are stored in any layer.

---

## Common Mistakes

### Mistake 1: Secrets in Image History

```dockerfile
ENV API_KEY=sk-prod-12345
```

```bash
docker history myapp:latest
```

Every ENV instruction is visible in the image history. Even if you later unset it.

### Mistake 2: Secrets in docker-compose.yml

```yaml
services:
  api:
    environment:
      DB_PASSWORD: production-password-123
```

If this file is committed to git, the password is in your repository history forever. Even if you remove it in a later commit.

### Mistake 3: Committing .env Files

```bash
git add .env
git commit -m "add config"
git push
```

Congratulations, your secrets are now on GitHub. Even if you delete the file, `git log` has it forever. You'd need to use `git filter-branch` or BFG Repo-Cleaner to remove it from history.

### Mistake 4: Logging Secrets

```go
log.Printf("connecting to database: %s", databaseURL)
```

If `databaseURL` contains credentials (like `postgres://user:password@host:5432/db`), you just logged your password. Use structured logging and redact sensitive fields.

```go
log.Printf("connecting to database: %s", redactURL(databaseURL))
```

### Mistake 5: Secrets in Multi-Stage Build Cache

```dockerfile
FROM node:20-alpine AS builder
ARG NPM_TOKEN
RUN echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc
RUN npm install
RUN rm .npmrc

FROM node:20-alpine
COPY --from=builder /app .
CMD ["node", "server.js"]
```

The final image doesn't contain `.npmrc`, but the builder stage does. If the builder stage is cached or pushed, the secret is exposed.

---

## Practical Patterns

### Pattern 1: Environment-Based Configuration with Validation

```yaml
services:
  api:
    build: ./api
    env_file:
      - .env
    environment:
      ENVIRONMENT: ${ENVIRONMENT:-development}
      PORT: "8080"
      DB_HOST: postgres
      DB_PORT: "5432"
      DB_NAME: myapp
      DB_USER: myapp
      DB_PASSWORD: ${DB_PASSWORD:?DB_PASSWORD is required}
      REDIS_URL: redis://redis:6379
      LOG_LEVEL: ${LOG_LEVEL:-info}
      CORS_ORIGINS: ${CORS_ORIGINS:-http://localhost:3000}
```

### Pattern 2: Secret Files for Production

```yaml
services:
  api:
    build: ./api
    secrets:
      - db_password
      - api_key
      - jwt_secret
    environment:
      DB_PASSWORD_FILE: /run/secrets/db_password
      API_KEY_FILE: /run/secrets/api_key
      JWT_SECRET_FILE: /run/secrets/jwt_secret
      DB_HOST: postgres
      DB_PORT: "5432"

secrets:
  db_password:
    external: true
  api_key:
    external: true
  jwt_secret:
    external: true
```

`external: true` means the secret was created outside of Compose (via `docker secret create`).

### Pattern 3: Unified Secret Reader

Go:

```go
func loadSecretOrEnv(secretName, envName string) (string, error) {
	secretPath := filepath.Join("/run/secrets", secretName)

	if data, err := os.ReadFile(secretPath); err == nil {
		return strings.TrimSpace(string(data)), nil
	}

	filePath := os.Getenv(envName + "_FILE")
	if filePath != "" {
		data, err := os.ReadFile(filePath)
		if err != nil {
			return "", fmt.Errorf("reading secret file %s: %w", filePath, err)
		}
		return strings.TrimSpace(string(data)), nil
	}

	if value := os.Getenv(envName); value != "" {
		return value, nil
	}

	return "", fmt.Errorf("secret %s not found (tried /run/secrets/%s, %s_FILE, %s)",
		secretName, secretName, envName, envName)
}
```

Usage:

```go
dbPassword, err := loadSecretOrEnv("db_password", "DB_PASSWORD")
if err != nil {
    log.Fatal(err)
}
```

This function checks three locations in order:
1. Docker secret file (`/run/secrets/db_password`)
2. Custom file path via `_FILE` env var (`DB_PASSWORD_FILE=/path/to/secret`)
3. Plain environment variable (`DB_PASSWORD=value`)

### Pattern 4: Per-Environment .env Files

```
project/
├── .env.example          # Template (committed)
├── .env                  # Local dev (gitignored)
├── .env.development      # Shared dev defaults (committed, no secrets)
├── .env.test             # Test config (committed, no secrets)
└── .env.production       # Prod template (committed, no secrets)
```

```yaml
services:
  api:
    env_file:
      - .env.${ENVIRONMENT:-development}
      - path: .env
        required: false
```

The `required: false` means Compose won't error if `.env` doesn't exist (useful in CI).

### Pattern 5: Vault Integration

For production, consider HashiCorp Vault or cloud-native secret managers:

```go
func loadFromVault(path string) (map[string]string, error) {
	client, err := vault.NewClient(vault.DefaultConfig())
	if err != nil {
		return nil, fmt.Errorf("creating vault client: %w", err)
	}

	secret, err := client.Logical().Read(path)
	if err != nil {
		return nil, fmt.Errorf("reading vault secret at %s: %w", path, err)
	}

	if secret == nil || secret.Data == nil {
		return nil, fmt.Errorf("no secret found at %s", path)
	}

	result := make(map[string]string)
	data, ok := secret.Data["data"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("unexpected secret format at %s", path)
	}

	for key, value := range data {
		if strValue, ok := value.(string); ok {
			result[key] = strValue
		}
	}
	return result, nil
}
```

---

## Exercises

### Exercise 1: Spot the Vulnerabilities

Find all the security issues in this compose file:

```yaml
services:
  api:
    build:
      context: ./api
      args:
        GITHUB_TOKEN: ghp_abc123def456
    environment:
      DB_PASSWORD: supersecret
      API_KEY: sk-prod-789xyz
      JWT_SECRET: my-jwt-secret

  postgres:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: supersecret
```

List every issue and write the corrected version.

### Exercise 2: BuildKit Secrets

Create a Node.js project with a private npm package dependency. Write a Dockerfile that uses `--mount=type=secret` to authenticate with npm during the build without leaking the token.

Build the image and verify with `docker history` that no secret appears in any layer.

### Exercise 3: Secret Rotation

Design a pattern where you can rotate a database password without downtime:
1. Both old and new passwords work temporarily
2. Update the secret
3. Rolling restart of services
4. Remove the old password

Write the compose file and rotation script.

### Exercise 4: 12-Factor Config

Take a Go or TypeScript application and refactor its configuration to follow 12-factor principles:
- All config comes from environment variables
- Required variables cause a clear error if missing
- Optional variables have sensible defaults
- Secrets are read from files with environment variable fallback

---

## What Would Happen If...

**...you accidentally committed `.env` with production database credentials?**

Anyone with read access to the repository has your credentials. Even after you delete the file and push, it's in the git history. You must:
1. Immediately rotate the credentials
2. Use BFG Repo-Cleaner or `git filter-repo` to remove it from history
3. Force push the cleaned history
4. Have every team member re-clone

**...you put a secret in a Docker ENV and pushed the image to a public registry?**

The secret is in the image metadata. `docker inspect` reveals it. `docker history` reveals it. Pull the image, delete it from the registry, and rotate the credential. This has happened to major companies.

**...you used `--build-arg` for a secret instead of `--mount=type=secret`?**

Build args are recorded in image history. Even in a multi-stage build, the builder stage retains the arg. If the builder layer is cached anywhere, the secret is exposed. Always use BuildKit secret mounts for build-time secrets.

**...your `.env` file has `COMPOSE_PROJECT_NAME=production` and you run `docker compose down -v`?**

You just deleted production volumes. The project name determines which resources Compose manages. If `.env` accidentally has a production project name, Compose commands affect production resources. Use separate directories or explicit `-p` flags.

---

## Key Takeaways

1. ENV is for configuration, NOT for secrets — anyone can read it
2. Use BuildKit `--mount=type=secret` for build-time secrets
3. Use Docker Secrets (Swarm) or secret files for runtime secrets
4. Never commit `.env` files — commit `.env.example` instead
5. Follow 12-factor: config from environment, secrets from files, fail fast on missing required values
6. Write your apps to check `/run/secrets/` first, then `_FILE` env vars, then plain env vars
7. Rotate secrets immediately if they're exposed — don't just delete the evidence
8. Use `docker history` to verify no secrets leaked into your image layers
