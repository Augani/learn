# Lesson 07: Secrets & Configuration at Scale

## The Bank Vault Analogy

A bank doesn't leave cash in desk drawers. It uses a vault with access
controls, audit logs, time locks, and multiple layers of authentication.
Different employees have different levels of access. Every entry and exit
is recorded.

Secrets management works the same way. Database passwords, API keys, TLS
certificates — these are the crown jewels of your infrastructure. Leaving
them in environment variables, config files, or (worst of all) source code
is leaving cash in desk drawers.

```
  SECRETS ANTI-PATTERNS:

  ╔══════════════════════════════════════════════════════════════╗
  ║  NEVER DO THIS                                              ║
  ╠══════════════════════════════════════════════════════════════╣
  ║                                                            ║
  ║  DATABASE_URL=postgres://admin:p@ssw0rd@db:5432/app        ║
  ║  ^^ hardcoded in docker-compose.yaml                       ║
  ║                                                            ║
  ║  AWS_SECRET_ACCESS_KEY=AKIA...                             ║
  ║  ^^ committed to .env file in git                          ║
  ║                                                            ║
  ║  apiKey: "sk-live-abc123..."                               ║
  ║  ^^ in a Kubernetes ConfigMap                              ║
  ║                                                            ║
  ║  const DB_PASS = "hunter2"                                 ║
  ║  ^^ hardcoded in source code                               ║
  ╚══════════════════════════════════════════════════════════════╝

  WHAT TO DO INSTEAD:

  ╔══════════════════════════════════════════════════════════════╗
  ║  Database password  -> Vault dynamic secret (auto-rotated)  ║
  ║  AWS credentials    -> IAM role with OIDC (no static key)   ║
  ║  API keys           -> Vault KV store (audited access)      ║
  ║  TLS certificates   -> Cert-manager (auto-renewed)          ║
  ╚══════════════════════════════════════════════════════════════╝
```

## Vault as a Platform Service

HashiCorp Vault is the industry standard for secrets management. Running
Vault as a platform service means your developers don't manage Vault
infrastructure — they consume secrets through well-defined interfaces.

```
  VAULT PLATFORM ARCHITECTURE:

  +================================================================+
  |  DEVELOPER INTERFACES                                           |
  |  [Sidecar Injector]  [CSI Driver]  [CLI]  [API]  [Operator]   |
  +================================================================+
                              |
                              v
  +================================================================+
  |  VAULT CLUSTER (platform-managed)                               |
  |                                                                |
  |  +--------------+  +--------------+  +------------------+      |
  |  | Auth Methods |  | Secret       |  | Audit Logging    |      |
  |  | - K8s JWT    |  | Engines      |  | - Every access   |      |
  |  | - OIDC       |  | - KV v2      |  |   is logged      |      |
  |  | - AppRole    |  | - Database   |  | - Tamper-proof   |      |
  |  | - AWS IAM    |  | - PKI        |  |                  |      |
  |  +--------------+  | - Transit    |  +------------------+      |
  |                     | - AWS        |                            |
  |  +--------------+  +--------------+  +------------------+      |
  |  | Policies     |                    | HA / DR           |      |
  |  | - Per-team   |                    | - 3 node cluster  |      |
  |  | - Per-env    |                    | - Auto-unseal     |      |
  |  | - Least priv |                    | - Cross-region    |      |
  |  +--------------+                    +------------------+      |
  |                                                                |
  +================================================================+
```

### Vault Policy for Team-Based Access

```hcl
path "secret/data/{{identity.entity.aliases.kubernetes.metadata.service_account_namespace}}/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

path "database/creds/{{identity.entity.aliases.kubernetes.metadata.service_account_namespace}}-*" {
  capabilities = ["read"]
}

path "pki/issue/{{identity.entity.aliases.kubernetes.metadata.service_account_namespace}}" {
  capabilities = ["create", "update"]
}

path "transit/encrypt/{{identity.entity.aliases.kubernetes.metadata.service_account_namespace}}-*" {
  capabilities = ["update"]
}

path "transit/decrypt/{{identity.entity.aliases.kubernetes.metadata.service_account_namespace}}-*" {
  capabilities = ["update"]
}
```

This policy template ensures each team's namespace can only access its own
secrets. The Kubernetes service account namespace is used as the identity
boundary — no team can read another team's secrets.

### Kubernetes Auth Configuration

```bash
vault auth enable kubernetes

vault write auth/kubernetes/config \
  kubernetes_host="https://kubernetes.default.svc" \
  kubernetes_ca_cert=@/var/run/secrets/kubernetes.io/serviceaccount/ca.crt

vault write auth/kubernetes/role/payments-service \
  bound_service_account_names=payments-service \
  bound_service_account_namespaces=payments-team \
  policies=payments-team-policy \
  ttl=1h
```

## Secret Injection Patterns

There are several ways to deliver secrets to applications. Each has trade-offs.

```
  SECRET INJECTION PATTERNS:

  +------------------+------------------+------------------+
  | SIDECAR          | CSI DRIVER       | INIT CONTAINER   |
  +------------------+------------------+------------------+
  | Vault Agent runs | Secrets mounted  | One-time fetch   |
  | alongside app    | as files via     | at pod startup   |
  | as a sidecar     | volume driver    |                  |
  +------------------+------------------+------------------+
  | + Auto-renewal   | + No sidecar     | + Simple         |
  | + Template       |   overhead       | + Low overhead   |
  |   rendering      | + Native K8s     | - No renewal     |
  | + Dynamic secrets|   volume mount   | - Static until   |
  | - Extra resources| - File-based     |   pod restart    |
  | - More complex   |   only           |                  |
  +------------------+------------------+------------------+
```

### Vault Agent Sidecar Injection

The most common pattern in Kubernetes: annotate your pod, and the Vault
Agent Injector automatically adds a sidecar:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: payments-service
  namespace: payments-team
spec:
  replicas: 3
  template:
    metadata:
      annotations:
        vault.hashicorp.com/agent-inject: "true"
        vault.hashicorp.com/role: "payments-service"
        vault.hashicorp.com/agent-inject-secret-db: "database/creds/payments-db"
        vault.hashicorp.com/agent-inject-template-db: |
          {{- with secret "database/creds/payments-db" -}}
          {
            "host": "payments-db.internal",
            "port": 5432,
            "username": "{{ .Data.username }}",
            "password": "{{ .Data.password }}"
          }
          {{- end }}
        vault.hashicorp.com/agent-inject-secret-api-key: "secret/data/payments-team/stripe"
        vault.hashicorp.com/agent-inject-template-api-key: |
          {{- with secret "secret/data/payments-team/stripe" -}}
          {{ .Data.data.api_key }}
          {{- end }}
    spec:
      serviceAccountName: payments-service
      containers:
        - name: payments-service
          image: registry.internal/payments-service:latest
          volumeMounts:
            - name: vault-secrets
              mountPath: /vault/secrets
              readOnly: true
```

The application reads secrets from `/vault/secrets/db` and
`/vault/secrets/api-key`. The sidecar handles authentication, secret
fetching, and automatic renewal.

### Vault CSI Provider

For teams that prefer volume mounts without a sidecar:

```yaml
apiVersion: secrets-store.csi.x-k8s.io/v1
kind: SecretProviderClass
metadata:
  name: payments-secrets
  namespace: payments-team
spec:
  provider: vault
  parameters:
    roleName: payments-service
    vaultAddress: https://vault.internal:8200
    objects: |
      - objectName: "db-password"
        secretPath: "database/creds/payments-db"
        secretKey: "password"
      - objectName: "stripe-key"
        secretPath: "secret/data/payments-team/stripe"
        secretKey: "api_key"
  secretObjects:
    - secretName: payments-secrets
      type: Opaque
      data:
        - objectName: db-password
          key: DB_PASSWORD
        - objectName: stripe-key
          key: STRIPE_API_KEY
```

## Dynamic Secrets

Dynamic secrets are generated on demand, scoped to a specific consumer, and
automatically expire. They're one of the most powerful platform capabilities
because they eliminate the biggest risk in secrets management: long-lived
credentials that accumulate over time.

```
  STATIC VS DYNAMIC SECRETS:

  STATIC SECRET:
  +--------+                    +-------+
  | App A  |--- uses same ---->|  DB   |
  | App B  |--- password ----->|       |
  | App C  |--- forever ------>|       |
  +--------+                    +-------+
  Risk: if ANY app leaks the password, ALL apps are compromised.
  Rotation: painful, requires updating all consumers simultaneously.

  DYNAMIC SECRET:
  +--------+     Vault generates unique,     +-------+
  | App A  |---> short-lived credential ---->|  DB   |
  +--------+     (username_a, pass_a, 1h)    |       |
  +--------+                                 |       |
  | App B  |---> (username_b, pass_b, 1h) -->|       |
  +--------+                                 |       |
  +--------+                                 |       |
  | App C  |---> (username_c, pass_c, 1h) -->|       |
  +--------+                                 +-------+
  Risk: leaked credential is scoped to one app and expires in 1 hour.
  Rotation: automatic — Vault generates new creds before old ones expire.
```

### Database Dynamic Secrets Configuration

```bash
vault secrets enable database

vault write database/config/payments-db \
  plugin_name=postgresql-database-plugin \
  connection_url="postgresql://{{username}}:{{password}}@payments-db.internal:5432/payments" \
  allowed_roles="payments-readonly,payments-readwrite" \
  username="vault_admin" \
  password="vault_admin_password"

vault write database/roles/payments-readonly \
  db_name=payments-db \
  creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; GRANT SELECT ON ALL TABLES IN SCHEMA public TO \"{{name}}\";" \
  revocation_statements="REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM \"{{name}}\"; DROP ROLE IF EXISTS \"{{name}}\";" \
  default_ttl="1h" \
  max_ttl="24h"

vault write database/roles/payments-readwrite \
  db_name=payments-db \
  creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO \"{{name}}\";" \
  revocation_statements="REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM \"{{name}}\"; DROP ROLE IF EXISTS \"{{name}}\";" \
  default_ttl="1h" \
  max_ttl="24h"
```

Now when a service requests database credentials:

```bash
$ vault read database/creds/payments-readonly
Key                Value
---                -----
lease_id           database/creds/payments-readonly/abc123
lease_duration     1h
username           v-payments-readonly-xyz789
password           A1B2C3-generated-password
```

The credentials are unique, short-lived, and automatically revoked after
the TTL expires.

## Configuration Management

Secrets are one half of the equation. Configuration — feature flags,
service endpoints, timeouts, rate limits — is the other half.

```
  CONFIGURATION LAYERS:

  +------------------------------------------------------------------+
  |  LAYER 4: Runtime overrides (feature flags, kill switches)       |
  |           Source: LaunchDarkly / Flagsmith / custom               |
  +------------------------------------------------------------------+
  |  LAYER 3: Environment-specific (staging vs production)           |
  |           Source: ConfigMaps / environment variables              |
  +------------------------------------------------------------------+
  |  LAYER 2: Service defaults (sane defaults for this service)      |
  |           Source: config file in repo                             |
  +------------------------------------------------------------------+
  |  LAYER 1: Platform defaults (org-wide standards)                 |
  |           Source: platform config service                         |
  +------------------------------------------------------------------+

  Precedence: Layer 4 overrides 3 overrides 2 overrides 1
```

### Typed Configuration in Go

```go
package config

import (
	"fmt"
	"os"
	"time"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Server   ServerConfig   `yaml:"server"`
	Database DatabaseConfig `yaml:"database"`
	Cache    CacheConfig    `yaml:"cache"`
	Features FeatureFlags   `yaml:"features"`
}

type ServerConfig struct {
	Port            int           `yaml:"port"`
	ReadTimeout     time.Duration `yaml:"read_timeout"`
	WriteTimeout    time.Duration `yaml:"write_timeout"`
	ShutdownTimeout time.Duration `yaml:"shutdown_timeout"`
}

type DatabaseConfig struct {
	Host            string        `yaml:"host"`
	Port            int           `yaml:"port"`
	Name            string        `yaml:"name"`
	MaxConnections  int           `yaml:"max_connections"`
	ConnMaxLifetime time.Duration `yaml:"conn_max_lifetime"`
	SecretPath      string        `yaml:"secret_path"`
}

type CacheConfig struct {
	Host string        `yaml:"host"`
	Port int           `yaml:"port"`
	TTL  time.Duration `yaml:"ttl"`
}

type FeatureFlags struct {
	NewPaymentFlow bool `yaml:"new_payment_flow"`
	AsyncProcessing bool `yaml:"async_processing"`
}

func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("reading config file: %w", err)
	}

	data = []byte(os.ExpandEnv(string(data)))

	cfg := &Config{
		Server: ServerConfig{
			Port:            8080,
			ReadTimeout:     30 * time.Second,
			WriteTimeout:    30 * time.Second,
			ShutdownTimeout: 15 * time.Second,
		},
		Database: DatabaseConfig{
			MaxConnections:  25,
			ConnMaxLifetime: 5 * time.Minute,
		},
	}

	if err := yaml.Unmarshal(data, cfg); err != nil {
		return nil, fmt.Errorf("parsing config: %w", err)
	}

	if err := cfg.validate(); err != nil {
		return nil, fmt.Errorf("validating config: %w", err)
	}

	return cfg, nil
}

func (c *Config) validate() error {
	if c.Server.Port < 1 || c.Server.Port > 65535 {
		return fmt.Errorf("server port must be between 1 and 65535")
	}
	if c.Database.Host == "" {
		return fmt.Errorf("database host is required")
	}
	if c.Database.MaxConnections < 1 {
		return fmt.Errorf("database max_connections must be positive")
	}
	return nil
}
```

### Environment-Specific Config with Kustomize

```yaml
# base/config.yaml
server:
  port: 8080
  read_timeout: 30s
  write_timeout: 30s
database:
  name: payments
  max_connections: 25
  secret_path: vault://database/creds/payments-db

---
# overlays/staging/config-patch.yaml
database:
  host: payments-db.staging.internal
  port: 5432
  max_connections: 10

---
# overlays/production/config-patch.yaml
database:
  host: payments-db.production.internal
  port: 5432
  max_connections: 50
```

## Secret Rotation

Secrets need rotation — even dynamic secrets eventually need their root
credentials updated. The platform should automate this entirely.

```
  ROTATION WORKFLOW:

  +------------------------------------------------------------------+
  |  AUTOMATED SECRET ROTATION                                       |
  +------------------------------------------------------------------+
  |                                                                  |
  |  1. Rotation triggers (schedule or event)                        |
  |     +----------+                                                 |
  |     | Cron: 30d|  or  [Security event]  or  [Manual trigger]     |
  |     +----------+                                                 |
  |                                                                  |
  |  2. New secret generated                                         |
  |     +------------------+                                         |
  |     | Vault creates    |                                         |
  |     | new credential   |                                         |
  |     +------------------+                                         |
  |                                                                  |
  |  3. Consumers updated (zero downtime)                            |
  |     +------------------+                                         |
  |     | Vault Agent      |                                         |
  |     | refreshes creds  |                                         |
  |     | in sidecars      |                                         |
  |     +------------------+                                         |
  |                                                                  |
  |  4. Old secret revoked                                           |
  |     +------------------+                                         |
  |     | After grace       |                                         |
  |     | period, old creds |                                         |
  |     | are deleted        |                                         |
  |     +------------------+                                         |
  |                                                                  |
  +------------------------------------------------------------------+
```

### Rotation Automation with Vault

```bash
vault write sys/policies/password/platform-standard \
  policy=-<<EOF
length=32
rule "charset" {
  charset = "abcdefghijklmnopqrstuvwxyz"
  min-chars = 1
}
rule "charset" {
  charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  min-chars = 1
}
rule "charset" {
  charset = "0123456789"
  min-chars = 1
}
rule "charset" {
  charset = "!@#$%^&*"
  min-chars = 1
}
EOF

vault write database/config/payments-db \
  password_policy="platform-standard"

vault write -f database/rotate-root/payments-db
```

## Zero-Trust Patterns

Zero trust means: never assume a request is safe because of where it comes
from. Every access must be authenticated, authorized, and encrypted —
even between services in the same cluster.

```
  ZERO-TRUST SECRET ACCESS:

  +------------------------------------------------------------------+
  |  Traditional (castle-and-moat):                                  |
  |  "If you're inside the VPN, you can access anything"            |
  |                                                                  |
  |  +--------+    VPN     +----------------------------------+     |
  |  | Dev    |----------->| All secrets accessible            |     |
  |  +--------+            +----------------------------------+     |
  +------------------------------------------------------------------+

  +------------------------------------------------------------------+
  |  Zero-trust:                                                     |
  |  "Prove who you are, prove you need it, get only what you need" |
  |                                                                  |
  |  +--------+    OIDC    +-------+  Policy  +--------+  Audit    |
  |  | Service|----------->| Vault |--------->| Secret |---------->|
  |  +--------+  identity  +-------+  check   +--------+  log     |
  |                                                                  |
  |  Checks:                                                         |
  |  1. Service identity (K8s SA, OIDC token)                       |
  |  2. Policy allows this identity to read this path               |
  |  3. Secret is scoped (dynamic, short TTL)                       |
  |  4. Access is logged and auditable                               |
  +------------------------------------------------------------------+
```

### mTLS Between Services

```yaml
apiVersion: platform.acme.com/v1
kind: ServiceMesh
metadata:
  name: payments-mtls
  namespace: payments-team
spec:
  service: payments-service
  mtls:
    mode: STRICT
    certificateProvider: vault-pki
    rotationInterval: 24h

  accessPolicy:
    allowFrom:
      - service: checkout-service
        namespace: checkout-team
      - service: subscription-service
        namespace: billing-team
    denyAll: true
```

### OIDC for CI/CD (No Long-Lived Tokens)

```yaml
- name: Authenticate to Vault
  uses: hashicorp/vault-action@v2
  with:
    url: https://vault.internal:8200
    method: jwt
    role: github-actions-payments
    jwtGithubAudience: https://vault.internal
    secrets: |
      secret/data/payments-team/deploy DEPLOY_TOKEN | DEPLOY_TOKEN ;
      database/creds/payments-db username | DB_USERNAME ;
      database/creds/payments-db password | DB_PASSWORD
```

No static tokens stored in GitHub secrets. The GitHub Actions OIDC token
authenticates directly to Vault, and Vault validates it against the
configured trust policy.

## Platform Secret Service Design

```
  PLATFORM SECRETS SERVICE:

  $ platform secrets --help
  Manage secrets through the platform

  Commands:
    create    Create a new secret
    get       Read a secret value
    list      List secrets for a team
    rotate    Trigger secret rotation
    audit     View access log for a secret
    share     Share a secret with another team (requires approval)

  $ platform secrets create \
      --path payments-team/stripe-key \
      --value "sk-live-..." \
      --rotation-days 90

  Secret created at: vault://secret/data/payments-team/stripe-key
  Rotation: every 90 days (next: 2025-04-15)
  Access: payments-team (read/write)

  $ platform secrets audit payments-team/stripe-key --last 7d
  TIME                  IDENTITY                    ACTION
  2025-01-15 10:30:00   payments-service (k8s)      read
  2025-01-15 10:30:00   payments-service (k8s)      read
  2025-01-14 14:22:00   alice@acme.com (oidc)       read
  2025-01-13 09:00:00   platform-rotation (approle) rotate
```

## Exercises

1. **Secret inventory.** Audit a service at your organization. Where are
   secrets stored? Environment variables? ConfigMaps? Hardcoded? Create a
   migration plan to move everything to Vault.

2. **Dynamic secrets setup.** Configure Vault's database secrets engine for
   a PostgreSQL database. Create readonly and readwrite roles with 1-hour
   TTLs. Test that credentials are automatically created and revoked.

3. **Injection pattern comparison.** Implement secret injection for the same
   application using three methods: sidecar, CSI driver, and init container.
   Compare complexity, resource usage, and renewal behavior.

4. **Zero-trust audit.** Evaluate your organization's secret access against
   zero-trust principles. Where are long-lived credentials? Where is
   network location used as an implicit trust boundary? Design a remediation
   plan.
