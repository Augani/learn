# Lesson 15: Secrets Management -- Nuclear Launch Codes for Your Software

Every application has secrets -- API keys, database passwords, TLS certificates,
OAuth client secrets, encryption keys. These are the crown jewels of your system.
If an attacker gets them, they own everything your application can access. Yet
developers routinely treat these secrets with less care than they treat their
Netflix password.

Secrets management is like handling nuclear launch codes. You don't write them
on a sticky note and tape it to your monitor (hardcode in source). You don't
shout them across the office (environment variables in logs). You don't hand
copies to everyone on the team (shared credentials). You store them in a vault
with access logs, time limits, need-to-know access, and automatic rotation.

---

## The Problem: Secrets Are Everywhere

A typical web application needs:

```
Database connection strings    ->  postgres://admin:s3cret@db.prod:5432/myapp
API keys                       ->  sk-proj-abc123def456...
TLS certificates               ->  private key for HTTPS
OAuth client secrets           ->  used to authenticate with Google, GitHub, etc.
Encryption keys                ->  for encrypting user data at rest
SMTP credentials               ->  for sending email
Cloud provider credentials     ->  AWS access keys, GCP service accounts
Webhook signing secrets        ->  for verifying incoming webhooks
JWT signing keys               ->  for minting authentication tokens
```

That is a lot of sensitive material. Every single one of those values, if leaked,
gives an attacker a direct path into your system or your users' data.

---

## What NOT to Do

### Mistake 1: Hardcoding Secrets in Source Code

This is the most common and most dangerous mistake. It happens every single day.

```go
package main

import (
    "database/sql"
    "net/http"

    _ "github.com/lib/pq"
)

func main() {
    db, _ := sql.Open("postgres",
        "postgres://admin:SuperSecret123@prod-db.example.com:5432/myapp")

    stripeKey := "sk_live_EXAMPLE_KEY_DO_NOT_USE"

    http.HandleFunc("/charge", func(w http.ResponseWriter, r *http.Request) {
        _ = db
        _ = stripeKey
    })
    http.ListenAndServe(":8080", nil)
}
```

The moment you commit this, the secret lives in git history forever. Even if
you delete the line in the next commit, anyone with access to the repo can run
`git log -p` and find it. GitHub has automated scanners that detect pushed
secrets within seconds -- and so do attackers.

**Real-world breach:** In 2019, a security researcher found over 100,000 GitHub
repos containing AWS access keys, database passwords, and API tokens. Automated
bots scan every public GitHub push in real time, and compromised AWS keys get
used within minutes of being pushed.

### Mistake 2: Committing .env Files

Slightly better than hardcoding, but still terrible when it ends up in git.

```
# .env -- THIS SHOULD NEVER BE IN GIT
DATABASE_URL=postgres://admin:SuperSecret123@prod-db.example.com:5432/myapp
STRIPE_SECRET_KEY=sk_live_EXAMPLE_KEY_DO_NOT_USE
JWT_SECRET=my-super-secret-jwt-key
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

Your .gitignore must always include `.env`:

```gitignore
.env
.env.local
.env.production
*.key
*.pem
```

But .gitignore only prevents future commits. If .env was committed even once,
the secret is in the git history.

### Mistake 3: Passing Secrets as CLI Arguments

This one surprises people. Command-line arguments are visible to every user on
the system.

```bash
# DO NOT DO THIS
./myapp --db-password=SuperSecret123 --api-key=sk_live_EXAMPLE_DO_NOT_USE
```

Any user on the same machine can see your secrets:

```bash
$ ps aux | grep myapp
deploy  12345  0.1  0.5  ./myapp --db-password=SuperSecret123 --api-key=sk_live_EXAMPLE_DO_NOT_USE
```

The `ps aux` command shows the full command line of every running process.
Your secrets are right there for anyone logged into the server to read. This
is not theoretical -- shared hosting, CI/CD runners, and Kubernetes nodes all
have multiple processes running, and `ps` sees everything.

### Mistake 4: Logging Secrets

Applications dump environment variables, request headers, and configuration
into logs all the time. One careless log line exposes everything.

```typescript
// VULNERABLE: logging the entire config object
import express from "express";

const app = express();

const config = {
  dbUrl: process.env.DATABASE_URL,
  stripeKey: process.env.STRIPE_SECRET_KEY,
  jwtSecret: process.env.JWT_SECRET,
};

console.log("Starting with config:", JSON.stringify(config));
```

That log line just wrote your database password and Stripe key to stdout,
which probably goes to CloudWatch, Datadog, or a log file that dozens of
people can read.

---

## Level 1: Environment Variables (Better, But Not Great)

Environment variables are the most common approach. They keep secrets out of
source code, which is the critical first step.

```typescript
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const stripeKey = process.env.STRIPE_SECRET_KEY;

if (!stripeKey) {
  throw new Error("STRIPE_SECRET_KEY environment variable is required");
}
```

```go
package main

import (
    "database/sql"
    "log"
    "os"

    _ "github.com/lib/pq"
)

func main() {
    dbURL := os.Getenv("DATABASE_URL")
    if dbURL == "" {
        log.Fatal("DATABASE_URL environment variable is required")
    }

    db, err := sql.Open("postgres", dbURL)
    if err != nil {
        log.Fatal(err)
    }
    defer db.Close()
}
```

### Why Environment Variables Are Not Enough

Environment variables have real weaknesses:

1. **Visible to child processes** -- every subprocess inherits the parent's environment
2. **Visible in /proc** -- on Linux, `cat /proc/<pid>/environ` shows them
3. **Often logged** -- crash dumps, debug output, and process managers capture them
4. **No access control** -- every piece of code in your process can read every env var
5. **No rotation** -- changing a secret means restarting the process
6. **No audit trail** -- no log of who accessed what secret, when

```bash
# Anyone with access to the host can read env vars of running processes
$ cat /proc/12345/environ | tr '\0' '\n'
DATABASE_URL=postgres://admin:SuperSecret123@prod-db.example.com:5432/myapp
STRIPE_SECRET_KEY=sk_live_EXAMPLE_KEY_DO_NOT_USE
```

Environment variables are the minimum acceptable approach. They are the bicycle
lock of secrets management -- better than nothing, but a determined attacker cuts
right through.

---

## Level 2: Docker Secrets (Swarm Mode)

Docker Swarm provides a built-in secrets mechanism. Secrets are stored encrypted
in the Raft log and mounted as files inside containers -- never as environment
variables.

Think of it like a sealed envelope. Docker holds the envelope (encrypted secret)
and only opens it for the specific container that needs it, placing the contents
in a file that only that container can read.

```bash
# Create a secret
echo "SuperSecret123" | docker secret create db_password -

# Use it in a service
docker service create \
  --name myapp \
  --secret db_password \
  myapp:latest
```

Inside the container, the secret appears as a file:

```go
package main

import (
    "os"
    "strings"
)

func readDockerSecret(name string) (string, error) {
    data, err := os.ReadFile("/run/secrets/" + name)
    if err != nil {
        return "", err
    }
    return strings.TrimSpace(string(data)), nil
}

func main() {
    dbPassword, err := readDockerSecret("db_password")
    if err != nil {
        panic(err)
    }
    _ = dbPassword
}
```

```typescript
import { readFile } from "node:fs/promises";

async function readDockerSecret(name: string): Promise<string> {
  const secret = await readFile(`/run/secrets/${name}`, "utf-8");
  return secret.trim();
}

async function main() {
  const dbPassword = await readDockerSecret("db_password");
}

main();
```

**Limitation:** Docker Secrets only works with Docker Swarm. If you are using
Kubernetes, docker-compose for local dev, or anything else, you need a different
approach.

---

## Level 3: Kubernetes Secrets (Common Misconception Alert)

Kubernetes has a built-in Secret resource. Many engineers believe Kubernetes
Secrets are encrypted. **They are not.** They are base64 encoded, which is
encoding, not encryption. Anyone who can read the Secret object sees the value.

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: myapp-secrets
type: Opaque
data:
  db-password: U3VwZXJTZWNyZXQxMjM=    # base64 of "SuperSecret123"
  api-key: c2tfbGl2ZV9hYmMxMjM=         # base64 of "sk_live_EXAMPLE_DO_NOT_USE"
```

Decoding is trivial:

```bash
$ echo "U3VwZXJTZWNyZXQxMjM=" | base64 -d
SuperSecret123
```

That is not security. That is obscurity. Base64 is a reversible encoding meant
for transporting binary data in text formats. It provides zero confidentiality.

### Using Kubernetes Secrets Properly

Mount secrets as files (not environment variables) and enable encryption at rest:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp
spec:
  containers:
    - name: myapp
      image: myapp:latest
      volumeMounts:
        - name: secrets
          mountPath: /etc/secrets
          readOnly: true
  volumes:
    - name: secrets
      secret:
        secretName: myapp-secrets
```

Enable encryption at rest in the API server config:

```yaml
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
  - resources:
      - secrets
    providers:
      - aescbc:
          keys:
            - name: key1
              secret: <base64-encoded-32-byte-key>
      - identity: {}
```

Even with encryption at rest, anyone with RBAC access to read Secrets in that
namespace can still see the plaintext values through the API. Kubernetes Secrets
are a storage mechanism, not a security mechanism.

---

## Level 4: HashiCorp Vault (The Real Deal)

Vault is a purpose-built secrets management system. It handles storage, access
control, auditing, rotation, and dynamic secret generation. This is the nuclear
launch code facility -- proper access controls, logging, time limits, and
compartmentalization.

### What Makes Vault Different

1. **Dynamic secrets** -- Vault generates database credentials on demand with automatic expiration
2. **Leasing** -- every secret has a TTL (time to live) and must be renewed or it expires
3. **Audit logging** -- every access is logged with who, what, when
4. **Fine-grained policies** -- control exactly which paths each service can read
5. **Secret rotation** -- automatic rotation without application restarts
6. **Encryption as a service** -- encrypt/decrypt without exposing the key

### Setting Up Vault

```bash
# Start Vault in dev mode (NEVER use dev mode in production)
vault server -dev

# In another terminal
export VAULT_ADDR='http://127.0.0.1:8200'

# Store a secret
vault kv put secret/myapp/config \
    db_password="SuperSecret123" \
    api_key="sk_live_EXAMPLE_DO_NOT_USE"

# Read it back
vault kv get secret/myapp/config

# Create a policy for your app
vault policy write myapp-read - <<EOF
path "secret/data/myapp/*" {
  capabilities = ["read"]
}
EOF

# Create an AppRole for your service
vault auth enable approle
vault write auth/approle/role/myapp \
    token_policies="myapp-read" \
    token_ttl=1h \
    token_max_ttl=4h
```

### Dynamic Database Credentials

This is Vault's killer feature. Instead of a single shared database password,
Vault creates a unique username/password pair for each service instance, with
automatic expiration.

```bash
# Configure the database secrets engine
vault secrets enable database

vault write database/config/mydb \
    plugin_name=postgresql-database-plugin \
    allowed_roles="myapp-role" \
    connection_url="postgresql://{{username}}:{{password}}@db.example.com:5432/myapp" \
    username="vault_admin" \
    password="vault_admin_password"

vault write database/roles/myapp-role \
    db_name=mydb \
    creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO \"{{name}}\";" \
    default_ttl="1h" \
    max_ttl="24h"
```

Now every time your application asks for credentials, Vault creates a fresh
database user that expires in one hour:

```go
package main

import (
    "context"
    "database/sql"
    "fmt"
    "log"
    "time"

    vault "github.com/hashicorp/vault/api"
    _ "github.com/lib/pq"
)

type VaultDBProvider struct {
    client *vault.Client
    role   string
}

func NewVaultDBProvider(addr, token, role string) (*VaultDBProvider, error) {
    config := vault.DefaultConfig()
    config.Address = addr

    client, err := vault.NewClient(config)
    if err != nil {
        return nil, fmt.Errorf("creating vault client: %w", err)
    }

    client.SetToken(token)

    return &VaultDBProvider{
        client: client,
        role:   role,
    }, nil
}

func (v *VaultDBProvider) GetConnection(ctx context.Context) (*sql.DB, time.Duration, error) {
    secret, err := v.client.Logical().ReadWithContext(ctx,
        "database/creds/"+v.role)
    if err != nil {
        return nil, 0, fmt.Errorf("reading db creds from vault: %w", err)
    }

    username := secret.Data["username"].(string)
    password := secret.Data["password"].(string)

    connStr := fmt.Sprintf(
        "postgres://%s:%s@db.example.com:5432/myapp?sslmode=require",
        username, password)

    db, err := sql.Open("postgres", connStr)
    if err != nil {
        return nil, 0, fmt.Errorf("opening database: %w", err)
    }

    leaseDuration := time.Duration(secret.LeaseDuration) * time.Second
    return db, leaseDuration, nil
}

func main() {
    provider, err := NewVaultDBProvider(
        "http://127.0.0.1:8200",
        "s.mytoken",
        "myapp-role",
    )
    if err != nil {
        log.Fatal(err)
    }

    db, ttl, err := provider.GetConnection(context.Background())
    if err != nil {
        log.Fatal(err)
    }
    defer db.Close()

    log.Printf("Got database connection, lease expires in %v", ttl)
}
```

```typescript
import Vault from "node-vault";
import pg from "pg";

interface VaultDBCreds {
  username: string;
  password: string;
  leaseDuration: number;
}

async function getVaultDBCreds(
  vaultAddr: string,
  token: string,
  role: string
): Promise<VaultDBCreds> {
  const client = Vault({
    apiVersion: "v1",
    endpoint: vaultAddr,
    token: token,
  });

  const result = await client.read(`database/creds/${role}`);

  return {
    username: result.data.username,
    password: result.data.password,
    leaseDuration: result.lease_duration,
  };
}

async function main() {
  const creds = await getVaultDBCreds(
    "http://127.0.0.1:8200",
    "s.mytoken",
    "myapp-role"
  );

  const pool = new pg.Pool({
    host: "db.example.com",
    port: 5432,
    database: "myapp",
    user: creds.username,
    password: creds.password,
    ssl: { rejectUnauthorized: true },
  });

  console.log(
    `Connected with dynamic creds, lease expires in ${creds.leaseDuration}s`
  );

  setTimeout(() => {
    pool.end();
    console.log("Lease expired, connection closed");
  }, creds.leaseDuration * 1000);
}

main();
```

The beauty of dynamic secrets: if credentials are compromised, they expire
automatically. There is no long-lived password to rotate in an emergency.
Each service instance gets unique credentials, so you can trace exactly
which instance accessed what.

---

## Level 5: Cloud Provider Secret Managers

### AWS Secrets Manager

AWS Secrets Manager stores secrets encrypted with KMS and supports automatic
rotation through Lambda functions.

```typescript
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

interface AppSecrets {
  dbPassword: string;
  apiKey: string;
}

async function getSecrets(secretName: string): Promise<AppSecrets> {
  const client = new SecretsManagerClient({ region: "us-east-1" });

  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretName })
  );

  if (!response.SecretString) {
    throw new Error(`Secret ${secretName} has no string value`);
  }

  return JSON.parse(response.SecretString) as AppSecrets;
}

async function main() {
  const secrets = await getSecrets("prod/myapp/config");
  console.log("Secrets loaded successfully");
}

main();
```

```go
package main

import (
    "context"
    "encoding/json"
    "fmt"
    "log"

    "github.com/aws/aws-sdk-go-v2/config"
    "github.com/aws/aws-sdk-go-v2/service/secretsmanager"
)

type AppSecrets struct {
    DBPassword string `json:"dbPassword"`
    APIKey     string `json:"apiKey"`
}

func getSecrets(ctx context.Context, secretName string) (*AppSecrets, error) {
    cfg, err := config.LoadDefaultConfig(ctx, config.WithRegion("us-east-1"))
    if err != nil {
        return nil, fmt.Errorf("loading AWS config: %w", err)
    }

    client := secretsmanager.NewFromConfig(cfg)
    result, err := client.GetSecretValue(ctx, &secretsmanager.GetSecretValueInput{
        SecretId: &secretName,
    })
    if err != nil {
        return nil, fmt.Errorf("getting secret %s: %w", secretName, err)
    }

    var secrets AppSecrets
    if err := json.Unmarshal([]byte(*result.SecretString), &secrets); err != nil {
        return nil, fmt.Errorf("parsing secret JSON: %w", err)
    }

    return &secrets, nil
}

func main() {
    secrets, err := getSecrets(context.Background(), "prod/myapp/config")
    if err != nil {
        log.Fatal(err)
    }
    _ = secrets
    log.Println("Secrets loaded successfully")
}
```

### GCP Secret Manager

```go
package main

import (
    "context"
    "fmt"
    "log"

    secretmanager "cloud.google.com/go/secretmanager/apiv1"
    "cloud.google.com/go/secretmanager/apiv1/secretmanagerpb"
)

func getGCPSecret(ctx context.Context, projectID, secretID, version string) (string, error) {
    client, err := secretmanager.NewClient(ctx)
    if err != nil {
        return "", fmt.Errorf("creating secret manager client: %w", err)
    }
    defer client.Close()

    name := fmt.Sprintf("projects/%s/secrets/%s/versions/%s",
        projectID, secretID, version)

    result, err := client.AccessSecretVersion(ctx,
        &secretmanagerpb.AccessSecretVersionRequest{Name: name})
    if err != nil {
        return "", fmt.Errorf("accessing secret %s: %w", name, err)
    }

    return string(result.Payload.Data), nil
}

func main() {
    secret, err := getGCPSecret(context.Background(),
        "my-project", "db-password", "latest")
    if err != nil {
        log.Fatal(err)
    }
    _ = secret
    log.Println("Secret loaded from GCP")
}
```

---

## Level 6: Sealed Secrets for Kubernetes

The problem with Kubernetes Secrets is that you cannot store them in git
(they contain plaintext base64 values). But you want GitOps -- everything
in version control. Sealed Secrets solves this by encrypting secrets so they
CAN be stored in git safely.

Think of it like a lockbox. You put your secret in the box and lock it with
a public key. Only the Sealed Secrets controller in your cluster has the
private key to open it. Anyone can see the locked box (encrypted value in
git), but only your cluster can read the contents.

```bash
# Install the controller in your cluster
helm repo add sealed-secrets https://bitnami-labs.github.io/sealed-secrets
helm install sealed-secrets sealed-secrets/sealed-secrets

# Install the CLI tool
brew install kubeseal

# Create a normal Secret manifest
kubectl create secret generic myapp-secrets \
    --from-literal=db-password=SuperSecret123 \
    --from-literal=api-key=sk_live_EXAMPLE_DO_NOT_USE \
    --dry-run=client -o yaml > secret.yaml

# Seal it (encrypt with the cluster's public key)
kubeseal --format yaml < secret.yaml > sealed-secret.yaml
```

The sealed version looks like this and is safe to commit to git:

```yaml
apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
metadata:
  name: myapp-secrets
  namespace: default
spec:
  encryptedData:
    db-password: AgBy8hDn3kZ...long-encrypted-string...
    api-key: AgCE9mRp7xK...long-encrypted-string...
```

When applied to the cluster, the Sealed Secrets controller decrypts it and
creates a regular Kubernetes Secret that your pods can use.

---

## Level 7: SOPS (Secrets OPerationS) -- Encrypted Files in Git

SOPS, created by Mozilla, encrypts specific values in YAML, JSON, or ENV files
while leaving the keys readable. This means you can see the structure of your
config in git, but the actual secret values are encrypted.

Think of it like a redacted document. You can see the headings and structure
(which secrets exist, what they are called), but the actual values are blacked
out (encrypted). Only authorized people with the right key can un-redact them.

### SOPS Workflow

```bash
# Install SOPS
brew install sops

# Create a SOPS config pointing to your KMS key (AWS example)
cat > .sops.yaml << 'EOF'
creation_rules:
  - path_regex: \.enc\.yaml$
    kms: arn:aws:kms:us-east-1:123456789:key/abcd-1234-efgh-5678
  - path_regex: \.enc\.json$
    kms: arn:aws:kms:us-east-1:123456789:key/abcd-1234-efgh-5678
EOF
```

Create a secrets file:

```yaml
# secrets.enc.yaml (before encryption -- this is what you edit)
database:
    password: SuperSecret123
    host: db.example.com
api:
    stripe_key: sk_live_EXAMPLE_DO_NOT_USE
    sendgrid_key: SG.abcdef123456
```

Encrypt it:

```bash
$ sops --encrypt secrets.enc.yaml > secrets.enc.yaml.tmp && mv secrets.enc.yaml.tmp secrets.enc.yaml
```

After encryption, the file looks like this in git:

```yaml
database:
    password: ENC[AES256_GCM,data:aBcDeFgHiJkL,iv:...,tag:...,type:str]
    host: ENC[AES256_GCM,data:mNoPqRsTuVwX,iv:...,tag:...,type:str]
api:
    stripe_key: ENC[AES256_GCM,data:yZaBcDeFgHiJ,iv:...,tag:...,type:str]
    sendgrid_key: ENC[AES256_GCM,data:kLmNoPqRsTuV,iv:...,tag:...,type:str]
sops:
    kms:
        - arn: arn:aws:kms:us-east-1:123456789:key/abcd-1234-efgh-5678
    version: 3.7.3
```

You can see the structure (database.password exists, api.stripe_key exists) but
the values are encrypted. Only someone with access to the KMS key can decrypt.

### Using SOPS in Your Application

```bash
# Decrypt at deploy time
sops --decrypt secrets.enc.yaml > /tmp/secrets.yaml

# Or use sops exec to inject decrypted values
sops exec-env secrets.enc.yaml 'node server.js'
```

```go
package main

import (
    "fmt"
    "log"
    "os"

    "gopkg.in/yaml.v3"
)

type Secrets struct {
    Database struct {
        Password string `yaml:"password"`
        Host     string `yaml:"host"`
    } `yaml:"database"`
    API struct {
        StripeKey   string `yaml:"stripe_key"`
        SendgridKey string `yaml:"sendgrid_key"`
    } `yaml:"api"`
}

func loadSecrets(path string) (*Secrets, error) {
    data, err := os.ReadFile(path)
    if err != nil {
        return nil, fmt.Errorf("reading secrets file: %w", err)
    }

    var secrets Secrets
    if err := yaml.Unmarshal(data, &secrets); err != nil {
        return nil, fmt.Errorf("parsing secrets yaml: %w", err)
    }

    return &secrets, nil
}

func main() {
    secrets, err := loadSecrets("/tmp/secrets.yaml")
    if err != nil {
        log.Fatal(err)
    }
    _ = secrets
    log.Println("SOPS secrets loaded")
}
```

```typescript
import { readFile } from "node:fs/promises";
import YAML from "yaml";

interface Secrets {
  database: {
    password: string;
    host: string;
  };
  api: {
    stripe_key: string;
    sendgrid_key: string;
  };
}

async function loadSecrets(path: string): Promise<Secrets> {
  const raw = await readFile(path, "utf-8");
  return YAML.parse(raw) as Secrets;
}

async function main() {
  const secrets = await loadSecrets("/tmp/secrets.yaml");
  console.log("SOPS secrets loaded");
}

main();
```

---

## Secret Rotation Strategies

Secrets should be rotated regularly. Think of it like changing locks after an
employee leaves. Even if you don't know the locks were compromised, periodic
rotation limits the window of exposure.

### Strategy 1: Blue-Green Rotation

Accept both old and new secrets simultaneously, then phase out the old one.

```
Time 0:  App uses Secret-V1
Time 1:  Generate Secret-V2, configure app to accept BOTH V1 and V2
Time 2:  Update all clients to use V2
Time 3:  Revoke Secret-V1
```

### Strategy 2: Dynamic Secrets (Vault-Style)

Every credential is short-lived and unique. No rotation needed because
credentials expire automatically.

```
Request 1:  Vault creates user_abc123 / pass_xyz789  (TTL: 1 hour)
Request 2:  Vault creates user_def456 / pass_uvw321  (TTL: 1 hour)
After 1h:   Both credentials automatically expire
```

### Strategy 3: Automated Rotation with AWS Secrets Manager

```typescript
import {
  SecretsManagerClient,
  RotateSecretCommand,
} from "@aws-sdk/client-secrets-manager";

async function rotateSecret(secretName: string): Promise<void> {
  const client = new SecretsManagerClient({ region: "us-east-1" });

  await client.send(
    new RotateSecretCommand({
      SecretId: secretName,
      RotationRules: {
        AutomaticallyAfterDays: 30,
      },
    })
  );
}
```

### What a Rotation Failure Looks Like

**Real-world scenario:** In 2021, a company's automated rotation updated the
database password in Secrets Manager but failed to restart the application pods.
The application continued using the old password, which had been revoked.
Result: complete outage at 3 AM.

Rotation must be end-to-end:

```
1. Generate new secret
2. Verify new secret works (test connection)
3. Update the secret store
4. Notify/restart consumers
5. Verify consumers are using new secret
6. Revoke old secret
```

---

## Comparison: When to Use What

```
Approach              | Encryption | Rotation | Audit | Dynamic | Complexity
---------------------|------------|----------|-------|---------|----------
Env vars             | No         | Manual   | No    | No      | Trivial
Docker Secrets       | At rest    | Manual   | No    | No      | Low
K8s Secrets          | Optional   | Manual   | Via RBAC | No   | Low
Sealed Secrets       | Yes        | Manual   | Via git | No    | Medium
SOPS                 | Yes        | Manual   | Via git | No    | Medium
AWS Secrets Manager  | Yes        | Auto     | Yes   | No      | Medium
GCP Secret Manager   | Yes        | Auto     | Yes   | No      | Medium
HashiCorp Vault      | Yes        | Auto     | Yes   | Yes     | High
```

For a small team with a few services: SOPS or cloud provider secret managers.
For medium organizations: cloud secret managers with rotation.
For large organizations or high-security requirements: Vault with dynamic secrets.

---

## Common Mistakes Checklist

1. **Secrets in git history** -- use `git-secrets`, `trufflehog`, or `gitleaks` to scan
2. **Base64 is not encryption** -- Kubernetes Secrets are not secure by default
3. **Shared credentials** -- each service should have its own credentials
4. **No rotation** -- secrets should rotate at least every 90 days
5. **Secrets in logs** -- sanitize all log output, never log config objects wholesale
6. **Secrets in error messages** -- connection strings in stack traces leak passwords
7. **Long-lived API keys** -- prefer short-lived tokens with auto-expiry
8. **No audit trail** -- you should know who accessed what secret, when

---

## Hands-On Exercises

1. **Secret scanning**: Install `gitleaks` and scan one of your existing repositories.
   How many secrets (or false positives) does it find?

2. **SOPS workflow**: Set up SOPS with a local AGE key (no cloud KMS needed).
   Create a secrets file, encrypt it, commit the encrypted version to git,
   then decrypt it in a deploy script.

3. **Vault dynamic secrets**: Run Vault in dev mode, configure the database
   secrets engine with a local PostgreSQL, and write a Go or TypeScript
   program that fetches dynamic credentials.

4. **Sealed Secrets**: If you have a Kubernetes cluster (minikube is fine),
   install the Sealed Secrets controller and create a sealed secret that
   decrypts into a usable Kubernetes Secret.

5. **Rotation simulation**: Write a program that reads a secret from a file,
   then watches for changes to that file and reconnects when the secret
   changes (simulating rotation without downtime).

---

## Key Takeaways

- Never hardcode secrets. Never commit .env files. Never pass secrets as CLI args.
- Environment variables are the minimum bar, not the goal.
- Kubernetes Secrets are base64 encoded, not encrypted. Do not confuse encoding with encryption.
- Dynamic secrets (Vault) are the gold standard -- unique, short-lived, automatically expiring.
- SOPS lets you store encrypted secrets in git while keeping the file structure readable.
- Every secret access should be auditable: who accessed what, when, from where.
- Rotation is not optional. Automate it or it will not happen.
- The blast radius of a leaked secret should be small: short TTLs, narrow permissions, unique credentials per service.
