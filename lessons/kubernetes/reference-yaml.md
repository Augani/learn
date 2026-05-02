# Common Kubernetes YAML Templates

Every Kubernetes resource is defined in YAML. Think of YAML manifests like infrastructure blueprints — they describe what you want, and Kubernetes figures out how to build it.

Every manifest shares a common structure:

```yaml
apiVersion: <group/version>   # which API to use
kind: <ResourceType>          # what you're creating
metadata:                     # identity (name, labels, annotations)
  name: <name>
  namespace: <namespace>
  labels:
    key: value
spec:                         # the desired state (what you want)
```

---

## Pod

The smallest thing Kubernetes runs. One or more containers sharing network and storage. Like a desk that one or two people share.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: my-app
  namespace: default
  labels:
    app: my-app
    version: v1
spec:
  restartPolicy: Always
  containers:
    - name: app
      image: nginx:1.25
      ports:
        - containerPort: 80
          protocol: TCP
      resources:
        requests:
          cpu: 100m
          memory: 128Mi
        limits:
          cpu: 500m
          memory: 256Mi
      env:
        - name: APP_ENV
          value: "production"
      livenessProbe:
        httpGet:
          path: /healthz
          port: 80
        initialDelaySeconds: 10
        periodSeconds: 15
      readinessProbe:
        httpGet:
          path: /ready
          port: 80
        initialDelaySeconds: 5
        periodSeconds: 10
```

Field breakdown:
- `restartPolicy`: Always (default), OnFailure, or Never. Controls what happens when the container exits.
- `containerPort`: Declares which port the container listens on. Informational, doesn't actually open the port.
- `resources.requests`: Minimum guaranteed resources. Scheduler uses this to place the Pod.
- `resources.limits`: Maximum allowed resources. Container gets killed if it exceeds memory limit.
- `livenessProbe`: "Is the process alive?" Fails → Kubernetes restarts the container.
- `readinessProbe`: "Can it handle traffic?" Fails → removed from Service endpoints.
- `cpu: 100m`: 100 millicores = 0.1 CPU core. 1000m = 1 full core.
- `memory: 128Mi`: Mebibytes. 128Mi ≈ 134MB.

---

## Pod with Init Container

Init containers run before the main container starts. Like running migrations before your app boots.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-with-init
spec:
  initContainers:
    - name: wait-for-db
      image: busybox:1.36
      command: ['sh', '-c', 'until nc -z postgres-svc 5432; do sleep 2; done']
  containers:
    - name: app
      image: my-app:v1
      ports:
        - containerPort: 8080
```

- Init containers run sequentially, each must succeed before the next starts.
- Main container only starts after all init containers complete.
- Common uses: wait for dependencies, run database migrations, download config files.

---

## Multi-Container Pod (Sidecar)

Two containers sharing the same network and storage. Like two people at the same desk sharing a phone.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-with-sidecar
spec:
  volumes:
    - name: shared-logs
      emptyDir: {}
  containers:
    - name: app
      image: my-app:v1
      ports:
        - containerPort: 8080
      volumeMounts:
        - name: shared-logs
          mountPath: /var/log/app
    - name: log-shipper
      image: fluent-bit:latest
      volumeMounts:
        - name: shared-logs
          mountPath: /var/log/app
          readOnly: true
```

- Both containers share `localhost` — the sidecar can reach the app at `localhost:8080`.
- `emptyDir` volume exists as long as the Pod exists. Shared between all containers.

---

## Deployment

Manages ReplicaSets which manage Pods. Like a restaurant chain playbook that ensures N locations are always open.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  namespace: default
  labels:
    app: my-app
spec:
  replicas: 3
  revisionHistoryLimit: 10
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
        - name: app
          image: my-app:v1.2.0
          ports:
            - containerPort: 8080
          resources:
            requests:
              cpu: 200m
              memory: 256Mi
            limits:
              cpu: 1000m
              memory: 512Mi
          readinessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 15
            periodSeconds: 20
```

Field breakdown:
- `replicas`: How many identical Pods to run.
- `selector.matchLabels`: How the Deployment finds its Pods. Must match `template.metadata.labels`.
- `template`: Blueprint for each Pod. Every Pod created will match this template.
- `strategy.type`: RollingUpdate (default, zero downtime) or Recreate (kill all, then create new).
- `maxSurge: 1`: Allow 1 extra Pod during updates (so 4 total during rollout).
- `maxUnavailable: 0`: Never have fewer than 3 running Pods during updates.
- `revisionHistoryLimit`: How many old ReplicaSets to keep for rollback.

---

## Service — ClusterIP

Internal-only service. Only reachable from inside the cluster. Like an internal phone extension.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-app-svc
  namespace: default
spec:
  type: ClusterIP
  selector:
    app: my-app
  ports:
    - name: http
      port: 80
      targetPort: 8080
      protocol: TCP
```

- `selector`: Finds Pods with matching labels. This is how Services discover Pods.
- `port`: The port the Service listens on.
- `targetPort`: The port on the Pod to forward to.
- DNS name inside cluster: `my-app-svc.default.svc.cluster.local` or just `my-app-svc` within the same namespace.

---

## Service — NodePort

Exposes the service on a port on every node. Like putting a sign on every entrance of a building.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-app-nodeport
spec:
  type: NodePort
  selector:
    app: my-app
  ports:
    - name: http
      port: 80
      targetPort: 8080
      nodePort: 30080
```

- `nodePort`: The port opened on every node (range 30000-32767).
- Access via `<any-node-ip>:30080`.
- Also gets a ClusterIP (NodePort is a superset of ClusterIP).

---

## Service — LoadBalancer

Provisions an external load balancer (cloud providers only). Like renting a billboard that points to your store.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-app-lb
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-type: "nlb"
spec:
  type: LoadBalancer
  selector:
    app: my-app
  ports:
    - name: http
      port: 80
      targetPort: 8080
```

- Creates a cloud load balancer (AWS ELB/NLB, GCP Load Balancer, etc.).
- `annotations` configure provider-specific behavior.
- Expensive — one load balancer per Service. That's why Ingress exists.

---

## Service — Headless

No ClusterIP. DNS returns individual Pod IPs. Used with StatefulSets.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-db-headless
spec:
  clusterIP: None
  selector:
    app: my-db
  ports:
    - port: 5432
      targetPort: 5432
```

- `clusterIP: None` makes it headless.
- DNS query returns A records for each Pod (not a single virtual IP).
- Used when clients need to connect to specific Pods (databases, caches).

---

## ConfigMap

Non-sensitive configuration data. Like a bulletin board in the office.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: default
data:
  APP_ENV: "production"
  LOG_LEVEL: "info"
  MAX_CONNECTIONS: "100"
  config.yaml: |
    server:
      port: 8080
      timeout: 30s
    database:
      pool_size: 10
```

Using it as environment variables:

```yaml
spec:
  containers:
    - name: app
      image: my-app:v1
      envFrom:
        - configMapRef:
            name: app-config
```

Using it as a mounted file:

```yaml
spec:
  volumes:
    - name: config-volume
      configMap:
        name: app-config
        items:
          - key: config.yaml
            path: config.yaml
  containers:
    - name: app
      image: my-app:v1
      volumeMounts:
        - name: config-volume
          mountPath: /etc/app
          readOnly: true
```

- `data` holds key-value pairs. Values are strings.
- Can hold entire files (using the `|` multiline YAML syntax).
- `envFrom` injects all keys as environment variables.
- Volume mount puts each key as a file in the directory.

---

## Secret

Sensitive data. Base64 encoded (NOT encrypted). Like the HR filing cabinet — access controlled, but not a vault.

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: default
type: Opaque
data:
  DB_PASSWORD: cGFzc3dvcmQxMjM=
  API_KEY: bXktc2VjcmV0LWtleQ==
```

Using `stringData` (plain text, Kubernetes encodes it for you):

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
type: Opaque
stringData:
  DB_PASSWORD: "password123"
  API_KEY: "my-secret-key"
```

Using it in a Pod:

```yaml
spec:
  containers:
    - name: app
      image: my-app:v1
      env:
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: DB_PASSWORD
```

- `data` values must be base64 encoded: `echo -n "password123" | base64`
- `stringData` accepts plain text (encoded on creation). Easier for development.
- `type: Opaque` is the generic catch-all type.
- Other types: `kubernetes.io/tls`, `kubernetes.io/dockerconfigjson`.

---

## PersistentVolumeClaim

A request for storage. Like renting a storage unit — you specify the size, the system provisions it.

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-data
  namespace: default
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: standard
  resources:
    requests:
      storage: 10Gi
```

Using it in a Pod:

```yaml
spec:
  volumes:
    - name: data
      persistentVolumeClaim:
        claimName: postgres-data
  containers:
    - name: postgres
      image: postgres:16
      volumeMounts:
        - name: data
          mountPath: /var/lib/postgresql/data
```

- `accessModes`: ReadWriteOnce (one node), ReadOnlyMany (many nodes read), ReadWriteMany (many nodes read/write).
- `storageClassName`: Which provisioner to use. `standard` is the default in most clusters.
- `storage: 10Gi`: Requested size. Dynamic provisioning creates a PV automatically.

---

## Ingress

Routes external HTTP traffic to Services. Like a lobby receptionist directing visitors.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-app-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - app.example.com
      secretName: app-tls-secret
  rules:
    - host: app.example.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: api-svc
                port:
                  number: 80
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend-svc
                port:
                  number: 80
```

- `ingressClassName`: Which Ingress controller handles this (nginx, traefik, etc.).
- `tls`: Enable HTTPS. Certificate stored in the referenced Secret.
- `rules`: Routing rules. Each rule matches a host and path.
- `pathType`: Prefix (matches /api/*), Exact (matches /api only), ImplementationSpecific.
- `annotations`: Controller-specific config (rate limiting, redirects, etc.).

---

## HorizontalPodAutoscaler

Automatically scales Pods based on metrics. Like hiring temp workers when the lunch rush hits.

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: my-app-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: my-app
  minReplicas: 2
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 10
          periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
        - type: Percent
          value: 100
          periodSeconds: 15
```

- `scaleTargetRef`: What to scale (usually a Deployment).
- `minReplicas/maxReplicas`: Bounds for scaling.
- `averageUtilization: 70`: Scale up when average CPU across Pods exceeds 70%.
- `behavior`: Controls how fast scaling happens. Prevents thrashing.
- `stabilizationWindowSeconds`: Wait this long before scaling down. Prevents rapid oscillation.
- Requires metrics-server in the cluster.

---

## Job

Runs a task to completion, then stops. Like a contractor you hire for one job.

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migration
spec:
  backoffLimit: 3
  activeDeadlineSeconds: 600
  ttlSecondsAfterFinished: 3600
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: migrate
          image: my-app:v1
          command: ["./migrate", "--direction=up"]
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: app-secrets
                  key: DATABASE_URL
```

- `backoffLimit`: How many times to retry on failure.
- `activeDeadlineSeconds`: Kill the Job after this many seconds (timeout).
- `ttlSecondsAfterFinished`: Auto-delete the Job after completion.
- `restartPolicy`: Must be Never or OnFailure for Jobs (not Always).

### Parallel Job

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: batch-process
spec:
  parallelism: 5
  completions: 20
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: worker
          image: my-worker:v1
```

- `completions: 20`: Need 20 successful completions.
- `parallelism: 5`: Run 5 at a time.

---

## CronJob

A Job on a schedule. Like a cron tab, but Kubernetes manages it.

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: nightly-backup
spec:
  schedule: "0 2 * * *"
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 5
  startingDeadlineSeconds: 300
  jobTemplate:
    spec:
      backoffLimit: 2
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: backup
              image: my-backup:v1
              command: ["./backup.sh"]
```

- `schedule`: Standard cron syntax. "0 2 * * *" = 2 AM every day.
- `concurrencyPolicy`: Forbid (skip if previous still running), Allow (run anyway), Replace (kill previous).
- `successfulJobsHistoryLimit`: How many completed Jobs to keep.
- `startingDeadlineSeconds`: If it misses the scheduled time by this much, skip it.

Cron syntax reminder:
```
┌───────────── minute (0-59)
│ ┌───────────── hour (0-23)
│ │ ┌───────────── day of month (1-31)
│ │ │ ┌───────────── month (1-12)
│ │ │ │ ┌───────────── day of week (0-6, Sunday=0)
│ │ │ │ │
* * * * *
```

---

## NetworkPolicy

Firewall rules for Pods. Default: all traffic allowed. NetworkPolicy restricts it.

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-network-policy
  namespace: default
spec:
  podSelector:
    matchLabels:
      app: api
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: frontend
        - namespaceSelector:
            matchLabels:
              name: monitoring
      ports:
        - protocol: TCP
          port: 8080
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: database
      ports:
        - protocol: TCP
          port: 5432
    - to:
        - namespaceSelector: {}
      ports:
        - protocol: UDP
          port: 53
```

- `podSelector`: Which Pods this policy applies to.
- `policyTypes`: Which directions to restrict (Ingress, Egress, or both).
- `ingress.from`: Who can send traffic TO these Pods.
- `egress.to`: Where these Pods can send traffic.
- The DNS egress rule (port 53) is almost always needed — Pods need to resolve names.
- Requires a CNI that supports NetworkPolicy (Calico, Cilium). Flannel does NOT.

### Deny All Ingress (Lockdown)

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all-ingress
spec:
  podSelector: {}
  policyTypes:
    - Ingress
```

Empty `podSelector` = applies to all Pods in the namespace. No `ingress` rules = deny all incoming.

---

## Namespace with ResourceQuota

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: team-backend
  labels:
    team: backend
---
apiVersion: v1
kind: ResourceQuota
metadata:
  name: team-backend-quota
  namespace: team-backend
spec:
  hard:
    requests.cpu: "10"
    requests.memory: 20Gi
    limits.cpu: "20"
    limits.memory: 40Gi
    pods: "50"
    services: "20"
    persistentvolumeclaims: "10"
---
apiVersion: v1
kind: LimitRange
metadata:
  name: default-limits
  namespace: team-backend
spec:
  limits:
    - default:
        cpu: 500m
        memory: 256Mi
      defaultRequest:
        cpu: 100m
        memory: 128Mi
      type: Container
```

- `ResourceQuota`: Total resource budget for the namespace.
- `LimitRange`: Default resource requests/limits for containers that don't specify them.
- Use both together — LimitRange ensures every Pod has limits, Quota caps the total.

---

## StatefulSet (Bonus)

For stateful apps that need stable network identity and persistent storage. Like numbered parking spots.

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
spec:
  serviceName: postgres-headless
  replicas: 3
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
        - name: postgres
          image: postgres:16
          ports:
            - containerPort: 5432
          volumeMounts:
            - name: data
              mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        storageClassName: standard
        resources:
          requests:
            storage: 10Gi
```

- `serviceName`: Must match a Headless Service.
- Pods get stable names: `postgres-0`, `postgres-1`, `postgres-2`.
- Each Pod gets its own PVC (not shared).
- Pods are created in order (0, 1, 2) and deleted in reverse order (2, 1, 0).
- `volumeClaimTemplates`: Auto-creates a PVC per Pod.
