# ConfigMaps and Secrets

## The Bulletin Board and HR Filing Cabinet

Every office has a bulletin board in the break room. Company policies, lunch schedules, the Wi-Fi password — information that everyone can see and reference. That's a **ConfigMap**.

The HR department has a locked filing cabinet. Employee salaries, social security numbers, medical records. Only authorized people can access it, and there's a log of who opens it. That's a **Secret**.

Both hold configuration data that your applications need. The difference is sensitivity. ConfigMaps are for non-sensitive config. Secrets are for passwords, API keys, and certificates.

In Go or TypeScript, you'd typically read config from environment variables or config files. ConfigMaps and Secrets are Kubernetes' way of injecting those values into your containers — without baking them into the Docker image.

---

## ConfigMaps

### Why not just put config in the Docker image?

If your Go API reads `DATABASE_HOST` from an environment variable, you could set it in the Dockerfile:

```dockerfile
ENV DATABASE_HOST=postgres.production.internal
```

But now your image only works in production. For staging, you'd need a different image. For local development, another one. The whole point of containers is "build once, run anywhere." Hardcoding config defeats that.

ConfigMaps let you separate configuration from code. Same image, different config per environment.

### Creating ConfigMaps

**From literals:**

```bash
kubectl create configmap app-config \
  --from-literal=DATABASE_HOST=postgres-svc \
  --from-literal=DATABASE_PORT=5432 \
  --from-literal=LOG_LEVEL=info \
  --from-literal=MAX_CONNECTIONS=100
```

**From a file:**

Create `app.env`:
```
DATABASE_HOST=postgres-svc
DATABASE_PORT=5432
LOG_LEVEL=info
MAX_CONNECTIONS=100
```

```bash
kubectl create configmap app-config --from-env-file=app.env
```

**From a config file:**

Create `config.yaml`:
```yaml
server:
  port: 8080
  timeout: 30s
  max_body_size: 10MB
database:
  host: postgres-svc
  port: 5432
  pool_size: 10
  max_idle: 5
logging:
  level: info
  format: json
```

```bash
kubectl create configmap app-config --from-file=config.yaml
```

This creates a ConfigMap with one key (`config.yaml`) whose value is the entire file contents.

**From a directory:**

```bash
kubectl create configmap app-config --from-file=./config/
```

Each file in the directory becomes a key-value pair (filename → contents).

**From YAML manifest:**

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: default
data:
  DATABASE_HOST: "postgres-svc"
  DATABASE_PORT: "5432"
  LOG_LEVEL: "info"
  MAX_CONNECTIONS: "100"
  config.yaml: |
    server:
      port: 8080
      timeout: 30s
    database:
      host: postgres-svc
      port: 5432
      pool_size: 10
```

All values in `data` are strings. Even numbers and booleans must be quoted. For binary data, use `binaryData` (base64 encoded).

### Inspect a ConfigMap

```bash
kubectl get configmap app-config

kubectl get configmap app-config -o yaml

kubectl describe configmap app-config
```

---

## Using ConfigMaps: Environment Variables

### Inject all keys as environment variables

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: my-api
  template:
    metadata:
      labels:
        app: my-api
    spec:
      containers:
        - name: api
          image: my-go-api:v1
          envFrom:
            - configMapRef:
                name: app-config
```

Every key in `app-config` becomes an environment variable:
- `DATABASE_HOST=postgres-svc`
- `DATABASE_PORT=5432`
- `LOG_LEVEL=info`
- `MAX_CONNECTIONS=100`

In Go:
```go
host := os.Getenv("DATABASE_HOST")
port := os.Getenv("DATABASE_PORT")
```

In TypeScript:
```typescript
const host = process.env.DATABASE_HOST;
const port = process.env.DATABASE_PORT;
```

### Inject specific keys

```yaml
spec:
  containers:
    - name: api
      image: my-go-api:v1
      env:
        - name: DB_HOST
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: DATABASE_HOST
        - name: DB_PORT
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: DATABASE_PORT
```

This lets you rename keys. The ConfigMap has `DATABASE_HOST`, but the container sees `DB_HOST`.

### Optional ConfigMap references

If the ConfigMap might not exist:

```yaml
env:
  - name: DB_HOST
    valueFrom:
      configMapKeyRef:
        name: app-config
        key: DATABASE_HOST
        optional: true
```

Without `optional: true`, the Pod fails to start if the ConfigMap is missing.

---

## Using ConfigMaps: Volume Mounts

Instead of environment variables, you can mount a ConfigMap as files.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: my-api
  template:
    metadata:
      labels:
        app: my-api
    spec:
      volumes:
        - name: config-volume
          configMap:
            name: app-config
      containers:
        - name: api
          image: my-go-api:v1
          volumeMounts:
            - name: config-volume
              mountPath: /etc/app/config
              readOnly: true
```

Each key in the ConfigMap becomes a file:
- `/etc/app/config/DATABASE_HOST` (contents: `postgres-svc`)
- `/etc/app/config/DATABASE_PORT` (contents: `5432`)
- `/etc/app/config/config.yaml` (contents: the YAML content)

### Mount specific keys only

```yaml
volumes:
  - name: config-volume
    configMap:
      name: app-config
      items:
        - key: config.yaml
          path: config.yaml
```

Only mounts `config.yaml` as `/etc/app/config/config.yaml`.

### Auto-update on change

When you mount a ConfigMap as a volume, Kubernetes automatically updates the files when the ConfigMap changes. The delay is typically 30-60 seconds.

Your app needs to watch the file for changes or periodically re-read it. In Go:

```go
watcher, _ := fsnotify.NewWatcher()
watcher.Add("/etc/app/config/config.yaml")
```

Environment variables are NOT updated when a ConfigMap changes. The container must be restarted to pick up new env var values.

### When to use env vars vs. volume mounts

| | Environment Variables | Volume Mounts |
|---|---|---|
| Simple key-value pairs | Yes | Overkill |
| Config files (YAML, JSON, TOML) | No (whole file as one env var is awkward) | Yes |
| Auto-update without restart | No | Yes (with file watching) |
| Binary data | No | Yes |
| Ease of use in code | `os.Getenv()` | File I/O |

---

## Secrets

### The Base64 Problem

Secrets in Kubernetes are base64 encoded, NOT encrypted. This is a critical distinction.

```bash
echo -n "my-password" | base64
# bXktcGFzc3dvcmQ=

echo -n "bXktcGFzc3dvcmQ=" | base64 -d
# my-password
```

Base64 is not security. It's encoding — like translating English to Pig Latin. Anyone who can read the Secret object can decode it.

By default, Secrets are stored in etcd **unencrypted**. Anyone with access to etcd can read all Secrets. This is why production clusters should enable encryption at rest for etcd.

So why use Secrets at all instead of ConfigMaps?

1. Kubernetes treats them differently in access control (RBAC can restrict Secret access separately)
2. Secrets are not printed in `kubectl describe` output
3. Secrets are not included in `kubectl get` output by default
4. Some features only work with Secrets (TLS certificates, image pull credentials)
5. Third-party tools can add real encryption (Sealed Secrets, External Secrets)

### Creating Secrets

**From literals:**

```bash
kubectl create secret generic app-secrets \
  --from-literal=DB_PASSWORD=supersecret123 \
  --from-literal=API_KEY=sk-abc123def456
```

**From files:**

```bash
kubectl create secret generic tls-certs \
  --from-file=tls.crt=./server.crt \
  --from-file=tls.key=./server.key
```

**From YAML manifest (base64 encoded):**

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
type: Opaque
data:
  DB_PASSWORD: c3VwZXJzZWNyZXQxMjM=
  API_KEY: c2stYWJjMTIzZGVmNDU2
```

Encode: `echo -n "supersecret123" | base64`

**From YAML manifest (plain text with stringData):**

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
type: Opaque
stringData:
  DB_PASSWORD: "supersecret123"
  API_KEY: "sk-abc123def456"
```

`stringData` is a write-only field. Kubernetes encodes it to base64 and stores it in `data`. When you `kubectl get secret -o yaml`, you'll see the base64 version in `data`, not the plain text.

### Secret Types

| Type | Use Case |
|------|----------|
| `Opaque` | Generic key-value pairs (default) |
| `kubernetes.io/tls` | TLS certificates (keys: `tls.crt`, `tls.key`) |
| `kubernetes.io/dockerconfigjson` | Docker registry credentials |
| `kubernetes.io/basic-auth` | Username/password pairs |
| `kubernetes.io/ssh-auth` | SSH private keys |

### Using Secrets in Pods

As environment variables:

```yaml
spec:
  containers:
    - name: api
      image: my-go-api:v1
      env:
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: DB_PASSWORD
      envFrom:
        - secretRef:
            name: app-secrets
```

As volume mounts:

```yaml
spec:
  volumes:
    - name: secret-volume
      secret:
        secretName: app-secrets
        defaultMode: 0400
  containers:
    - name: api
      image: my-go-api:v1
      volumeMounts:
        - name: secret-volume
          mountPath: /etc/secrets
          readOnly: true
```

`defaultMode: 0400` sets files to read-only for the file owner. Good practice for secrets.

### Viewing Secret values

```bash
kubectl get secret app-secrets -o yaml
```

Shows base64 values. To decode:

```bash
kubectl get secret app-secrets -o jsonpath='{.data.DB_PASSWORD}' | base64 -d
```

---

## Secret Management in Production

Base64 Secrets in Git is a security hole. Anyone with repo access can decode them. Here's how to do it properly.

### Option 1: Sealed Secrets

Bitnami's Sealed Secrets encrypts Secrets with a public key. Only the cluster's controller can decrypt them.

```bash
kubeseal --format yaml < secret.yaml > sealed-secret.yaml
```

The sealed-secret.yaml is safe to commit to Git. It's encrypted. The cluster's SealedSecrets controller decrypts it into a regular Secret.

### Option 2: External Secrets Operator

Syncs secrets from an external store (AWS Secrets Manager, HashiCorp Vault, GCP Secret Manager) into Kubernetes Secrets.

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: app-secrets
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: ClusterSecretStore
  target:
    name: app-secrets
  data:
    - secretKey: DB_PASSWORD
      remoteRef:
        key: production/database
        property: password
```

Your team manages secrets in AWS Secrets Manager (or Vault). The External Secrets Operator pulls them into the cluster automatically.

### Option 3: HashiCorp Vault with Sidecar Injector

Vault Agent runs as a sidecar in your Pod, fetching secrets at runtime.

```yaml
metadata:
  annotations:
    vault.hashicorp.com/agent-inject: "true"
    vault.hashicorp.com/role: "my-api"
    vault.hashicorp.com/agent-inject-secret-db: "secret/data/production/db"
```

Secrets never touch Kubernetes — they go directly from Vault to the Pod's filesystem.

### Option 4: SOPS (Mozilla)

Encrypts YAML files with age, PGP, or cloud KMS keys. The encrypted file is committed to Git. Decrypted at deploy time.

```bash
sops --encrypt --age <public-key> secret.yaml > secret.enc.yaml

sops --decrypt secret.enc.yaml | kubectl apply -f -
```

### Which to use?

| Approach | Complexity | Security Level | Best For |
|----------|-----------|---------------|----------|
| Base64 in Git | Low | None | Never in production |
| Sealed Secrets | Medium | Good | Small teams, straightforward needs |
| External Secrets | Medium | Great | Teams already using cloud secret stores |
| Vault | High | Excellent | Enterprise, strict compliance |
| SOPS | Low-Medium | Good | GitOps workflows |

---

## Hands-On: App with ConfigMap

### Setup

```bash
kind create cluster --name config-lab
```

### Create the ConfigMap

```bash
kubectl create configmap web-config \
  --from-literal=GREETING="Hello from Kubernetes" \
  --from-literal=COLOR=blue \
  --from-literal=PORT=8080
```

### Deploy an app that reads the config

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: configdemo
spec:
  replicas: 2
  selector:
    matchLabels:
      app: configdemo
  template:
    metadata:
      labels:
        app: configdemo
    spec:
      containers:
        - name: app
          image: busybox:1.36
          command:
            - sh
            - -c
            - |
              echo "Starting app with config:"
              echo "GREETING=$GREETING"
              echo "COLOR=$COLOR"
              echo "PORT=$PORT"
              while true; do sleep 3600; done
          envFrom:
            - configMapRef:
                name: web-config
```

```bash
kubectl apply -f configdemo.yaml

kubectl logs deployment/configdemo
```

You'll see the environment variables printed from the ConfigMap.

### Update the ConfigMap

```bash
kubectl create configmap web-config \
  --from-literal=GREETING="Updated greeting" \
  --from-literal=COLOR=red \
  --from-literal=PORT=8080 \
  --dry-run=client -o yaml | kubectl apply -f -
```

The ConfigMap is updated, but the running Pods still have the old env vars. Restart them:

```bash
kubectl rollout restart deployment/configdemo

kubectl logs deployment/configdemo
```

Now you see the updated values.

### Mount as a file instead

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: nginx-config
data:
  nginx.conf: |
    server {
        listen 80;
        server_name _;
        location / {
            return 200 'Hello from custom nginx config\n';
            add_header Content-Type text/plain;
        }
    }
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-custom
spec:
  replicas: 1
  selector:
    matchLabels:
      app: nginx-custom
  template:
    metadata:
      labels:
        app: nginx-custom
    spec:
      volumes:
        - name: nginx-config
          configMap:
            name: nginx-config
      containers:
        - name: nginx
          image: nginx:1.25
          ports:
            - containerPort: 80
          volumeMounts:
            - name: nginx-config
              mountPath: /etc/nginx/conf.d
              readOnly: true
```

```bash
kubectl apply -f nginx-configmap.yaml

kubectl expose deployment nginx-custom --port=80 --target-port=80

kubectl run test --image=curlimages/curl --rm -it --restart=Never -- curl http://nginx-custom:80
```

The nginx configuration comes from the ConfigMap. Change the ConfigMap, and the file updates automatically (nginx needs a reload to pick it up).

---

## Hands-On: Secrets

### Create a Secret

```bash
kubectl create secret generic db-creds \
  --from-literal=username=admin \
  --from-literal=password=supersecret123
```

### Verify it's stored as base64

```bash
kubectl get secret db-creds -o yaml
```

You'll see base64 values. Decode:

```bash
kubectl get secret db-creds -o jsonpath='{.data.password}' | base64 -d
```

### Use the Secret in a Pod

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: secret-test
spec:
  containers:
    - name: app
      image: busybox:1.36
      command:
        - sh
        - -c
        - |
          echo "DB Username: $DB_USER"
          echo "DB Password length: $(echo -n $DB_PASS | wc -c) characters"
          echo "(not printing the actual password)"
          sleep 3600
      env:
        - name: DB_USER
          valueFrom:
            secretKeyRef:
              name: db-creds
              key: username
        - name: DB_PASS
          valueFrom:
            secretKeyRef:
              name: db-creds
              key: password
```

```bash
kubectl apply -f secret-test.yaml

kubectl logs secret-test
```

### Mount Secret as files

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: secret-volume-test
spec:
  volumes:
    - name: secret-volume
      secret:
        secretName: db-creds
        defaultMode: 0400
  containers:
    - name: app
      image: busybox:1.36
      command:
        - sh
        - -c
        - |
          echo "Files in /etc/secrets:"
          ls -la /etc/secrets/
          echo "Username file contents: $(cat /etc/secrets/username)"
          sleep 3600
      volumeMounts:
        - name: secret-volume
          mountPath: /etc/secrets
          readOnly: true
```

```bash
kubectl apply -f secret-volume-test.yaml

kubectl logs secret-volume-test
```

Each key is a file with permissions `0400` (read-only, owner-only).

---

## ConfigMap and Secret Patterns for Go/TypeScript

### Go: Read config from environment with fallback

```go
func getEnv(key, fallback string) string {
    if value, ok := os.LookupEnv(key); ok {
        return value
    }
    return fallback
}

dbHost := getEnv("DATABASE_HOST", "localhost")
dbPort := getEnv("DATABASE_PORT", "5432")
```

### Go: Read config from mounted file

```go
data, err := os.ReadFile("/etc/app/config.yaml")
if err != nil {
    log.Fatalf("failed to read config: %v", err)
}

var config AppConfig
if err := yaml.Unmarshal(data, &config); err != nil {
    log.Fatalf("failed to parse config: %v", err)
}
```

### TypeScript: Read config from environment

```typescript
const config = {
  dbHost: process.env.DATABASE_HOST ?? 'localhost',
  dbPort: parseInt(process.env.DATABASE_PORT ?? '5432'),
  logLevel: process.env.LOG_LEVEL ?? 'info',
};
```

### The immutable ConfigMap

For ConfigMaps that should never change after creation:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config-v2
immutable: true
data:
  VERSION: "2.0.0"
  FEATURE_FLAGS: "new-ui,dark-mode"
```

Once `immutable: true` is set, the ConfigMap can't be updated — only deleted and recreated. This improves performance (Kubernetes skips watch updates) and prevents accidental changes.

---

## What Would Happen If...

**...you referenced a ConfigMap that doesn't exist?**

The Pod fails to start with `CreateContainerConfigError`. Check events:

```bash
kubectl describe pod my-pod
```

You'll see: "configmaps 'app-config' not found."

Use `optional: true` to prevent this.

**...you updated a ConfigMap used as environment variables?**

Nothing happens to running Pods. Env vars are injected at container start time and never updated. You must restart the Pods:

```bash
kubectl rollout restart deployment/my-api
```

**...you updated a ConfigMap mounted as a volume?**

The files update automatically (30-60 second delay). But your app must re-read the files to see changes. Most apps don't watch files, so you'd still restart.

**...you deleted a Secret that a running Pod references?**

Running Pods keep working — env vars are already loaded, mounted files are in memory. But if the Pod restarts, it fails to start (the Secret is gone).

**...a Secret contains a newline at the end?**

This is a classic bug. When creating from a file:

```bash
echo "mypassword" > password.txt
kubectl create secret generic db-pass --from-file=password=password.txt
```

`echo` adds a trailing newline. Your password is now `mypassword\n`. Your database connection fails. Fix:

```bash
echo -n "mypassword" > password.txt
```

Or use `--from-literal` which doesn't add newlines.

---

## Exercises

1. **Environment-specific configs.** Create three ConfigMaps: `config-dev`, `config-staging`, `config-prod`. Each has the same keys but different values. Deploy the same app three times, each referencing a different ConfigMap. Verify each instance has the right config.

2. **Config file hot-reload.** Mount a ConfigMap as a file. Exec into the Pod and `cat` the file. Update the ConfigMap. Wait 60 seconds and `cat` again. Verify the file changed without Pod restart.

3. **Secret rotation.** Create a Secret. Deploy an app using it. Update the Secret value. Verify the running Pod still has the old value. Restart the Pod and verify it has the new value.

4. **Combine ConfigMap and Secret.** Create a ConfigMap for non-sensitive config and a Secret for credentials. Deploy an app that uses both (ConfigMap via `envFrom`, Secret via individual `valueFrom`). Verify all values are accessible.

5. **Immutable ConfigMap.** Create an immutable ConfigMap. Try to update it. Observe the error. Delete and recreate it with the new value. This is the pattern for versioned configs.

---

## Key Takeaways

- ConfigMaps hold non-sensitive configuration; Secrets hold sensitive data
- Both can be injected as environment variables or mounted as files
- Env vars are NOT updated when ConfigMaps/Secrets change — restart required
- Volume mounts auto-update (with delay), but your app must re-read files
- Secrets are base64 encoded, NOT encrypted — use proper secret management in production
- Use Sealed Secrets, External Secrets Operator, or Vault for production secret management
- All ConfigMap values are strings — parse numbers/booleans in your code

Next: Volumes and PersistentVolumeClaims — persistent storage for your Pods.
