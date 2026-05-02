# Lesson 17: Helm — Package Management for Kubernetes

## The Big Picture

Imagine cooking dinner from scratch every single night. You measure every
ingredient, adjust every spice, time everything manually. It works, but it's
tedious and error-prone. Now imagine you have a recipe book. Each recipe lists
ingredients with default quantities. You follow the recipe but adjust to taste
— less salt, more garlic. If the dish turns out bad, you go back to last night's
version.

That's Helm. Your Kubernetes YAML files are the raw ingredients. A Helm
**chart** is the recipe — it templates those YAML files with sensible defaults.
**values** are your adjustments (less salt = smaller replicas, more garlic =
higher memory limits). A **release** is a specific meal you cooked (version 1
with defaults, version 2 with extra replicas). If version 2 tastes bad, you
**rollback** to version 1.

Without Helm, deploying a typical app means writing 5-10 YAML files (Deployment,
Service, ConfigMap, Secret, Ingress, HPA, etc.) and `kubectl apply` them all.
With Helm, it's one command.

---

## Prerequisites

- Lesson 04 (Deployments)
- Lesson 05 (Services)
- Lesson 06 (ConfigMaps and Secrets)

### Install Helm

```bash
brew install helm
```

Verify:

```bash
helm version
```

### Create a Cluster

```bash
kind create cluster --name helm-lab
```

---

## Helm Concepts

### Charts

A chart is a directory with a specific structure containing templates, default
values, and metadata. It's a package — like an npm package or a Go module.

### Values

A `values.yaml` file containing configurable parameters. When you install a
chart, you can override any value. It's like `package.json` defaults that you
can customize.

### Templates

Kubernetes YAML files with Go template syntax (`{{ .Values.replicas }}`). Helm
renders them with your values to produce standard YAML.

### Releases

A release is a specific installation of a chart with a name. You can have
multiple releases of the same chart (e.g., `redis-production` and
`redis-staging`) with different values.

### Repositories

Collections of charts, like npm registries. You add repos and install charts
from them.

---

## Installing Charts from Repositories

### Add a Repository

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update
```

### Search for Charts

```bash
helm search repo redis
```

```
NAME                    CHART VERSION   APP VERSION   DESCRIPTION
bitnami/redis           18.6.1          7.2.4         Redis open source...
bitnami/redis-cluster   9.4.3           7.2.4         Redis cluster...
```

### Install a Chart

```bash
helm install my-redis bitnami/redis \
  --set auth.enabled=false \
  --set architecture=standalone \
  --set master.persistence.size=256Mi
```

This creates a **release** named `my-redis` from the `bitnami/redis` chart.
The `--set` flags override default values.

### See What Was Deployed

```bash
helm list
```

```
NAME       NAMESPACE  REVISION  UPDATED                   STATUS    CHART         APP VERSION
my-redis   default    1         2024-01-15 10:30:00 UTC   deployed  redis-18.6.1  7.2.4
```

```bash
kubectl get all -l app.kubernetes.io/instance=my-redis
```

Helm created a Deployment (or StatefulSet), Service, ConfigMap, and Secret —
all from one command.

### Check the Generated YAML

Want to see what Helm actually deployed without installing?

```bash
helm template my-redis bitnami/redis \
  --set auth.enabled=false \
  --set architecture=standalone
```

This renders the templates to YAML and prints them. Useful for review before
installing.

### Inspect Chart Values

```bash
helm show values bitnami/redis | head -50
```

This shows all configurable values with their defaults. There are usually
hundreds of options.

### Upgrade a Release

```bash
helm upgrade my-redis bitnami/redis \
  --set auth.enabled=false \
  --set architecture=standalone \
  --set master.persistence.size=256Mi \
  --set master.resources.requests.memory=128Mi
```

This creates revision 2 of the release.

```bash
helm list
```

```
NAME       REVISION  STATUS    CHART
my-redis   2         deployed  redis-18.6.1
```

### Rollback

```bash
helm rollback my-redis 1
```

Back to revision 1. Check history:

```bash
helm history my-redis
```

```
REVISION  UPDATED      STATUS       CHART         DESCRIPTION
1         ...          superseded   redis-18.6.1  Install complete
2         ...          superseded   redis-18.6.1  Upgrade complete
3         ...          deployed     redis-18.6.1  Rollback to 1
```

### Uninstall

```bash
helm uninstall my-redis
```

All resources created by the release are deleted.

---

## Creating Your Own Chart

This is where Helm gets powerful. Let's create a chart for a Go or Node.js
application.

### Scaffold a Chart

```bash
helm create myapp
```

This creates:

```
myapp/
├── Chart.yaml
├── values.yaml
├── charts/
├── templates/
│   ├── NOTES.txt
│   ├── _helpers.tpl
│   ├── deployment.yaml
│   ├── hpa.yaml
│   ├── ingress.yaml
│   ├── service.yaml
│   ├── serviceaccount.yaml
│   └── tests/
│       └── test-connection.yaml
└── .helmignore
```

### Chart.yaml

```yaml
apiVersion: v2
name: myapp
description: A Helm chart for my Go/Node application
type: application
version: 0.1.0
appVersion: "1.0.0"
```

- **version**: the chart version (bump when you change templates)
- **appVersion**: the version of the application being deployed

### values.yaml

This is the configuration interface for your chart. Let's replace the
scaffolded one:

```yaml
# file: myapp/values.yaml
replicaCount: 2

image:
  repository: hashicorp/http-echo
  tag: latest
  pullPolicy: IfNotPresent

args:
- "-text=Hello from Helm"

service:
  type: ClusterIP
  port: 80
  targetPort: 5678

resources:
  requests:
    cpu: 100m
    memory: 64Mi
  limits:
    cpu: 200m
    memory: 128Mi

autoscaling:
  enabled: false
  minReplicas: 1
  maxReplicas: 10
  targetCPUUtilizationPercentage: 80

ingress:
  enabled: false
  className: nginx
  host: myapp.local

env: []

configMap:
  enabled: false
  data: {}
```

### Template: Deployment

Replace `myapp/templates/deployment.yaml`:

```yaml
# file: myapp/templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "myapp.fullname" . }}
  labels:
    {{- include "myapp.labels" . | nindent 4 }}
spec:
  {{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
  {{- end }}
  selector:
    matchLabels:
      {{- include "myapp.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "myapp.selectorLabels" . | nindent 8 }}
    spec:
      containers:
      - name: {{ .Chart.Name }}
        image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
        imagePullPolicy: {{ .Values.image.pullPolicy }}
        {{- if .Values.args }}
        args:
          {{- toYaml .Values.args | nindent 10 }}
        {{- end }}
        ports:
        - name: http
          containerPort: {{ .Values.service.targetPort }}
          protocol: TCP
        {{- if .Values.env }}
        env:
          {{- toYaml .Values.env | nindent 10 }}
        {{- end }}
        resources:
          {{- toYaml .Values.resources | nindent 10 }}
        livenessProbe:
          httpGet:
            path: /
            port: http
          initialDelaySeconds: 5
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /
            port: http
          initialDelaySeconds: 3
          periodSeconds: 5
```

### Template: Service

Replace `myapp/templates/service.yaml`:

```yaml
# file: myapp/templates/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: {{ include "myapp.fullname" . }}
  labels:
    {{- include "myapp.labels" . | nindent 4 }}
spec:
  type: {{ .Values.service.type }}
  ports:
  - port: {{ .Values.service.port }}
    targetPort: {{ .Values.service.targetPort }}
    protocol: TCP
    name: http
  selector:
    {{- include "myapp.selectorLabels" . | nindent 4 }}
```

### Template: HPA (Conditional)

Replace `myapp/templates/hpa.yaml`:

```yaml
# file: myapp/templates/hpa.yaml
{{- if .Values.autoscaling.enabled }}
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: {{ include "myapp.fullname" . }}
  labels:
    {{- include "myapp.labels" . | nindent 4 }}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {{ include "myapp.fullname" . }}
  minReplicas: {{ .Values.autoscaling.minReplicas }}
  maxReplicas: {{ .Values.autoscaling.maxReplicas }}
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: {{ .Values.autoscaling.targetCPUUtilizationPercentage }}
{{- end }}
```

### Template: ConfigMap (Conditional)

Create `myapp/templates/configmap.yaml`:

```yaml
# file: myapp/templates/configmap.yaml
{{- if .Values.configMap.enabled }}
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{ include "myapp.fullname" . }}
  labels:
    {{- include "myapp.labels" . | nindent 4 }}
data:
  {{- toYaml .Values.configMap.data | nindent 2 }}
{{- end }}
```

### The Helpers File

The `_helpers.tpl` file defines reusable template functions. The scaffolded
version is usually fine. It defines things like:

- `myapp.fullname` — generates the resource name (release name + chart name)
- `myapp.labels` — standard Kubernetes labels
- `myapp.selectorLabels` — labels used in selectors

---

## Install Your Chart

### Dry Run First

```bash
helm install myapp ./myapp --dry-run --debug
```

This renders all templates and shows the YAML without applying anything.
Always do this first.

### Install

```bash
helm install myapp ./myapp
```

```bash
kubectl get all -l app.kubernetes.io/instance=myapp
```

### Override Values

You can override values three ways:

**1. Command line**:

```bash
helm install myapp-v2 ./myapp \
  --set replicaCount=5 \
  --set image.tag=v2.0.0 \
  --set resources.limits.memory=256Mi
```

**2. Values file**:

```yaml
# file: production-values.yaml
replicaCount: 5

image:
  repository: myregistry/myapp
  tag: v2.0.0

resources:
  requests:
    cpu: 500m
    memory: 256Mi
  limits:
    cpu: "1"
    memory: 512Mi

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 20
  targetCPUUtilizationPercentage: 70

env:
- name: LOG_LEVEL
  value: "info"
- name: DATABASE_URL
  valueFrom:
    secretKeyRef:
      name: db-credentials
      key: url
```

```bash
helm install myapp-prod ./myapp -f production-values.yaml
```

**3. Multiple values files** (layered):

```bash
helm install myapp-prod ./myapp \
  -f base-values.yaml \
  -f production-values.yaml \
  --set image.tag=v2.1.0
```

Values are merged in order: later files override earlier ones, `--set` overrides
everything.

This maps perfectly to how you manage configs in Go/TypeScript apps: a base
config, environment-specific overrides, and command-line flags as final overrides.

---

## Helm Template Functions

Helm uses Go templates. Here are the most common patterns:

### Conditionals

```yaml
{{- if .Values.ingress.enabled }}
apiVersion: networking.k8s.io/v1
kind: Ingress
...
{{- end }}
```

### Loops

```yaml
env:
{{- range .Values.env }}
- name: {{ .name }}
  value: {{ .value | quote }}
{{- end }}
```

### Default Values

```yaml
replicas: {{ .Values.replicaCount | default 1 }}
```

### Required Values

```yaml
image: {{ required "image.repository is required" .Values.image.repository }}
```

If someone installs the chart without setting `image.repository`, Helm fails
with a clear error message instead of deploying a broken manifest.

### String Functions

```yaml
name: {{ .Release.Name | trunc 63 | trimSuffix "-" }}
annotations:
  checksum/config: {{ include (print .Template.BasePath "/configmap.yaml") . | sha256sum }}
```

The `sha256sum` trick forces a Deployment rollout when ConfigMap data changes
— the annotation changes, which triggers a new ReplicaSet.

---

## Helm Hooks

Hooks let you run actions at specific points in a release lifecycle.

### Pre-Install Hook: Database Migration

```yaml
# file: myapp/templates/migration-job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: {{ include "myapp.fullname" . }}-migrate
  annotations:
    "helm.sh/hook": pre-install,pre-upgrade
    "helm.sh/hook-weight": "-5"
    "helm.sh/hook-delete-policy": before-hook-creation
spec:
  backoffLimit: 3
  template:
    spec:
      containers:
      - name: migrate
        image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
        command: ["./migrate", "up"]
        env:
        - name: DATABASE_URL
          value: {{ .Values.databaseUrl | quote }}
      restartPolicy: Never
```

- **pre-install**: runs before any chart resources are created
- **pre-upgrade**: runs before an upgrade
- **hook-weight**: order when multiple hooks exist (lower runs first)
- **hook-delete-policy**: cleanup strategy

This means: before deploying the new version of your app, run the database
migration. If the migration fails, the deployment doesn't happen. This is the
same pattern from Lesson 14 (Jobs) but integrated into the release lifecycle.

### Common Hook Types

| Hook | When |
|------|------|
| `pre-install` | Before any resources are created |
| `post-install` | After all resources are created |
| `pre-upgrade` | Before an upgrade |
| `post-upgrade` | After an upgrade |
| `pre-delete` | Before a release is deleted |
| `post-delete` | After a release is deleted |
| `pre-rollback` | Before a rollback |
| `post-rollback` | After a rollback |

---

## Chart Dependencies

Your chart can depend on other charts. For example, your app needs Redis:

```yaml
# file: myapp/Chart.yaml
apiVersion: v2
name: myapp
version: 0.1.0
dependencies:
- name: redis
  version: 18.x.x
  repository: https://charts.bitnami.com/bitnami
  condition: redis.enabled
```

```yaml
# file: myapp/values.yaml
redis:
  enabled: true
  auth:
    enabled: false
  architecture: standalone
```

Update dependencies:

```bash
helm dependency update ./myapp
```

Helm downloads the Redis chart into `myapp/charts/`. When you install `myapp`,
Redis is automatically included.

---

## Packaging and Sharing Charts

### Package a Chart

```bash
helm package ./myapp
```

Creates `myapp-0.1.0.tgz`.

### Push to a Registry (OCI)

Helm 3.8+ supports OCI registries:

```bash
helm push myapp-0.1.0.tgz oci://registry.example.com/charts
```

### Install from OCI

```bash
helm install myapp oci://registry.example.com/charts/myapp --version 0.1.0
```

---

## Helm in CI/CD

A typical deployment pipeline:

```bash
#!/bin/bash
CHART_DIR="./deploy/helm/myapp"
RELEASE_NAME="myapp"
NAMESPACE="production"
IMAGE_TAG="${CI_COMMIT_SHA:0:8}"

helm upgrade --install "${RELEASE_NAME}" "${CHART_DIR}" \
  --namespace "${NAMESPACE}" \
  --create-namespace \
  -f "${CHART_DIR}/values-production.yaml" \
  --set image.tag="${IMAGE_TAG}" \
  --wait \
  --timeout 300s
```

- **upgrade --install**: installs if it doesn't exist, upgrades if it does
  (idempotent)
- **--wait**: waits for all resources to be ready before marking success
- **--timeout**: fails if readiness isn't achieved in time

This is equivalent to your TypeScript/Go CI pipeline deploying to a server,
but for Kubernetes.

---

## Relating to Go/TypeScript Patterns

### npm/go modules → Helm repos

```bash
npm install express        → helm install bitnami/redis
go get github.com/lib/pq   → helm install bitnami/postgresql
```

### package.json/go.mod → Chart.yaml

```json
{
  "dependencies": {
    "redis": "^4.0.0"
  }
}
```

```yaml
dependencies:
- name: redis
  version: 18.x.x
```

### Environment Variables → values.yaml

```typescript
const config = {
  port: process.env.PORT || 3000,
  replicas: process.env.REPLICAS || 1,
};
```

```yaml
service:
  port: 80
replicaCount: 1
```

### .env files → values-{env}.yaml

```bash
# .env.production
PORT=8080
LOG_LEVEL=warn
```

```yaml
# values-production.yaml
service:
  port: 8080
env:
- name: LOG_LEVEL
  value: warn
```

---

## Exercises

### Exercise 1: Install and Customize

1. Add the Bitnami repo
2. Install PostgreSQL with custom values: 1Gi storage, password "testpass"
3. Verify it's running
4. Upgrade to enable metrics exporter
5. Rollback to the version without metrics
6. Check `helm history` to see all revisions

### Exercise 2: Build a Chart

1. Create a chart for a simple web app
2. Make configurable: replicas, image, resources, environment variables
3. Add a conditional Ingress
4. Add a conditional HPA
5. Install with defaults, then upgrade with production values
6. Run `helm template` and review the generated YAML

### Exercise 3: Chart with Dependencies

1. Create a chart for an app that needs Redis
2. Add Redis as a dependency in Chart.yaml
3. Configure Redis values in your values.yaml
4. Run `helm dependency update`
5. Install and verify both your app and Redis are deployed
6. Connect your app to Redis using the auto-generated Service name

### Exercise 4: Hooks

1. Add a pre-install hook to your chart that runs a "migration" Job
2. Add a post-install hook that runs a smoke test
3. Install the chart and watch the hooks execute in order
4. Make the migration hook fail — observe that the install doesn't proceed

### Exercise 5: Values Layering

Create a chart with three values files:
1. `values.yaml` — base defaults (small resources, 1 replica)
2. `values-staging.yaml` — staging overrides (medium resources, 2 replicas)
3. `values-production.yaml` — production overrides (large resources, 5 replicas,
   HPA enabled)

Install with different combinations and verify the merged results with
`helm get values <release>`.

---

## What Would Happen If...

**Q: You install the same chart twice with the same release name?**
A: Helm refuses: "cannot re-use a name that is still in use." Use `helm upgrade`
instead, or choose a different release name.

**Q: You delete a resource that Helm created (with kubectl delete)?**
A: Helm doesn't know it's gone. On the next `helm upgrade`, Helm recreates it.
This is Helm's declarative model — it reconciles actual state with desired
state during upgrades.

**Q: Your template has a syntax error?**
A: `helm install` fails before anything is created. The template is rendered
client-side, so errors are caught early. Always run `helm template` first.

**Q: You forget a required value?**
A: If you used the `required` function in your template, Helm fails with a
clear error message. If you didn't, you get an empty string in the YAML, which
might cause Kubernetes to reject the resource.

**Q: Two people upgrade the same release simultaneously?**
A: Helm uses a locking mechanism (Kubernetes Secrets as storage). The second
upgrade waits or fails depending on timing. In CI/CD, serializing deployments
prevents this.

---

## Key Takeaways

1. **Charts** package Kubernetes resources into reusable, versioned units
2. **values.yaml** is the configuration interface — override for each
   environment
3. **Templates** use Go template syntax — conditionals, loops, functions
4. **Releases** track installed instances — upgrade, rollback, uninstall
5. **Hooks** run Jobs at lifecycle events (pre-install for migrations)
6. **Dependencies** let charts include other charts (your app + Redis)
7. **helm template** renders YAML without installing — always review first
8. **upgrade --install** is idempotent — safe for CI/CD pipelines

---

## Cleanup

```bash
helm uninstall myapp myapp-prod myapp-v2 my-redis 2>/dev/null
kind delete cluster --name helm-lab
rm -rf myapp/
```

---

Next: [Lesson 18: RBAC →](./18-rbac.md)
