# Pods

## The Desk Analogy

A Pod is a desk in an office.

Usually, one person sits at a desk (one container in a Pod). But sometimes two people share a desk — a developer and their pair programmer, sitting side by side, sharing the same phone line (localhost), the same filing cabinet (volumes), and the same desk nameplate (IP address).

The desk isn't the person. If the person leaves, the desk can be cleared and reassigned. Pods are the same way — they're wrappers around containers, and they're disposable. Kubernetes creates and destroys them freely.

---

## Why Not Just Run Containers?

If you come from Docker, you might ask: why does Kubernetes need this extra "Pod" concept? Why not just schedule containers directly?

Three reasons:

**1. Shared networking.** Two containers in a Pod share the same network namespace. They communicate over `localhost`, not over a network. This is essential for patterns like sidecars (a logging agent next to your app) and ambassadors (a proxy next to your database client).

In Docker, you'd do this with `--network container:other`. In Kubernetes, it's built into the Pod abstraction.

**2. Shared storage.** Containers in a Pod can mount the same volumes. Your app writes logs to `/var/log/app`; a sidecar reads from the same directory and ships them to your logging service. No network transfer needed — just filesystem reads.

**3. Lifecycle coupling.** Containers in a Pod start together, live together, and die together. If your app container crashes and can't be restarted, the whole Pod gets replaced. The sidecar doesn't keep running uselessly.

Think of it from Go's perspective: a Pod is like a `sync.WaitGroup` for containers. The Pod isn't "done" until all its containers are done (or failed). And all containers in the group share the same context (network, storage).

---

## Pod Specification

Here's a Pod manifest broken down:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: my-go-api
  namespace: default
  labels:
    app: my-go-api
    version: v1
    team: backend
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "9090"
spec:
  restartPolicy: Always
  terminationGracePeriodSeconds: 30
  containers:
    - name: api
      image: my-go-api:v1.0.0
      ports:
        - containerPort: 8080
          name: http
        - containerPort: 9090
          name: metrics
      resources:
        requests:
          cpu: 100m
          memory: 128Mi
        limits:
          cpu: 500m
          memory: 256Mi
      env:
        - name: PORT
          value: "8080"
        - name: LOG_LEVEL
          value: "info"
      livenessProbe:
        httpGet:
          path: /healthz
          port: 8080
        initialDelaySeconds: 10
        periodSeconds: 15
        timeoutSeconds: 3
        failureThreshold: 3
      readinessProbe:
        httpGet:
          path: /ready
          port: 8080
        initialDelaySeconds: 5
        periodSeconds: 10
        timeoutSeconds: 3
        failureThreshold: 3
      startupProbe:
        httpGet:
          path: /healthz
          port: 8080
        periodSeconds: 5
        failureThreshold: 30
```

### Labels vs. Annotations

**Labels** are for selection. Services use them to find Pods. Deployments use them to manage Pods. They're like tags on a filing system — you search by them.

```yaml
labels:
  app: my-go-api     # what application is this
  version: v1        # what version
  team: backend      # who owns it
```

**Annotations** are for metadata. Tools read them, but Kubernetes doesn't select by them. They're like sticky notes on a file — extra info for whoever picks it up.

```yaml
annotations:
  prometheus.io/scrape: "true"   # Prometheus reads this
  kubernetes.io/change-cause: "initial deploy"
```

### Resource Requests and Limits

This is where most people get confused. The analogy:

**Requests** = the minimum desk size you reserved. The scheduler won't put you at a desk that's too small. Even if you're not using the whole desk, it's reserved for you.

**Limits** = the maximum desk size you're allowed to use. If you try to spread out beyond your limit, security (the OOM killer) escorts you out.

```yaml
resources:
  requests:
    cpu: 100m       # guaranteed 0.1 CPU cores
    memory: 128Mi   # guaranteed 128 MiB of RAM
  limits:
    cpu: 500m       # can burst up to 0.5 CPU cores
    memory: 256Mi   # hard cap — exceed this and get OOM killed
```

CPU is compressible — if you hit the limit, you get throttled (slowed down). Memory is incompressible — if you hit the limit, your process gets killed.

For Go engineers: your Go runtime allocates memory. If the container's memory limit is 256Mi and your Go process tries to allocate 300Mi, the Linux kernel kills the process. The kubelet sees the OOM kill and restarts the container (if `restartPolicy: Always`).

**Common mistake**: Setting limits too low causes random OOM kills. Setting requests too high wastes cluster resources. Monitor actual usage with `kubectl top pods` and adjust.

### Health Probes

Three types of health checks, each serving a different purpose:

**Liveness Probe**: "Is the process alive?" If this fails, Kubernetes restarts the container. Like checking if a patient has a pulse.

```yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
  periodSeconds: 15
  failureThreshold: 3
```

If `/healthz` returns non-200 three times in a row (45 seconds), kill and restart the container.

**Readiness Probe**: "Can it handle traffic?" If this fails, the Pod is removed from Service endpoints (no traffic routed to it). Like checking if a doctor is available for patients.

```yaml
readinessProbe:
  httpGet:
    path: /ready
    port: 8080
  periodSeconds: 10
  failureThreshold: 3
```

Your Go API might be alive but not ready — maybe it's still loading a large config file or waiting for a database connection.

**Startup Probe**: "Has it started yet?" Replaces liveness/readiness during startup. Like giving a new employee their first day to get settled before expecting productivity.

```yaml
startupProbe:
  httpGet:
    path: /healthz
    port: 8080
  periodSeconds: 5
  failureThreshold: 30
```

This gives the container up to 150 seconds (5s x 30 attempts) to start. Useful for apps that have slow initialization (JVM warmup, large file loading).

For TypeScript/Go HTTP servers, a typical pattern:

```go
http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
    w.WriteHeader(http.StatusOK)
})

http.HandleFunc("/ready", func(w http.ResponseWriter, r *http.Request) {
    if dbConnected && cacheWarmed {
        w.WriteHeader(http.StatusOK)
    } else {
        w.WriteHeader(http.StatusServiceUnavailable)
    }
})
```

---

## Multi-Container Pods

Most Pods have one container. But there are legitimate reasons to put two containers in one Pod.

### Sidecar Pattern

A helper container that enhances the main container. Like a personal assistant sitting at the same desk.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: api-with-logging
spec:
  volumes:
    - name: log-volume
      emptyDir: {}
  containers:
    - name: api
      image: my-go-api:v1
      ports:
        - containerPort: 8080
      volumeMounts:
        - name: log-volume
          mountPath: /var/log/app

    - name: log-shipper
      image: fluent-bit:2.2
      volumeMounts:
        - name: log-volume
          mountPath: /var/log/app
          readOnly: true
```

The Go API writes structured logs to `/var/log/app/`. Fluent Bit reads from the same directory and ships them to Elasticsearch. They share the volume but run as separate processes.

Common sidecar uses:
- Log shipping (Fluent Bit, Filebeat)
- Metrics collection (Prometheus exporter)
- Service mesh proxy (Envoy, Istio)
- Certificate management (cert-manager)

### Ambassador Pattern

A proxy container that handles outbound traffic for the main container.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: api-with-proxy
spec:
  containers:
    - name: api
      image: my-go-api:v1
      env:
        - name: DATABASE_URL
          value: "localhost:5432"

    - name: cloud-sql-proxy
      image: gcr.io/cloud-sql-connectors/cloud-sql-proxy:2
      args: ["--port=5432", "my-project:us-central1:my-db"]
```

The Go API connects to `localhost:5432`. The Cloud SQL Proxy container handles authentication and TLS to the actual database. The API doesn't need to know about cloud credentials — that's the proxy's job.

### Adapter Pattern

A container that transforms the main container's output into a standard format.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: legacy-with-adapter
spec:
  volumes:
    - name: log-volume
      emptyDir: {}
  containers:
    - name: legacy-app
      image: legacy-app:v1
      volumeMounts:
        - name: log-volume
          mountPath: /var/log

    - name: log-adapter
      image: log-adapter:v1
      volumeMounts:
        - name: log-volume
          mountPath: /var/log
```

The legacy app writes logs in some custom format. The adapter reads them, converts to structured JSON, and writes them back. Downstream log shipping tools only need to understand JSON.

---

## Init Containers

Init containers run before the main containers start. They run sequentially, and each must succeed before the next starts. Think of them like setup scripts that run before your server boots.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: api-with-init
spec:
  initContainers:
    - name: wait-for-postgres
      image: busybox:1.36
      command:
        - sh
        - -c
        - |
          until nc -z postgres-svc 5432; do
            echo "waiting for postgres..."
            sleep 2
          done

    - name: run-migrations
      image: my-go-api:v1
      command: ["./migrate", "--direction=up"]
      env:
        - name: DATABASE_URL
          value: "postgres://user:pass@postgres-svc:5432/mydb?sslmode=disable"

  containers:
    - name: api
      image: my-go-api:v1
      ports:
        - containerPort: 8080
```

Execution order:
1. `wait-for-postgres` runs first. Loops until PostgreSQL is reachable.
2. `run-migrations` runs second. Applies database migrations.
3. Only then does `api` start. It can assume the database is ready and migrated.

If any init container fails, the whole Pod restarts from the beginning (running init containers again).

Common init container uses:
- Wait for dependencies (databases, caches, other services)
- Run database migrations
- Download configuration from a remote source
- Set up filesystem permissions

---

## Pod Lifecycle

Pods go through a defined lifecycle. Understanding the states helps you debug.

```
                    ┌──────────┐
                    │ Pending  │ ← Pod accepted, waiting for scheduling/image pull
                    └────┬─────┘
                         │
                    ┌────▼─────┐
                    │ Running  │ ← at least one container is running
                    └────┬─────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
        ┌─────▼────┐ ┌──▼───────┐ ┌▼─────────┐
        │Succeeded │ │  Failed  │ │  Unknown  │
        └──────────┘ └──────────┘ └───────────┘
```

**Pending**: The Pod has been accepted but isn't running yet. Reasons:
- Scheduler hasn't assigned it to a node yet
- Image is being pulled
- Init containers are running
- Waiting for a volume to be provisioned

**Running**: At least one container is running (or starting/restarting).

**Succeeded**: All containers exited with code 0. Normal for Jobs.

**Failed**: All containers have terminated, and at least one exited with a non-zero code.

**Unknown**: Node communication lost. kubelet isn't reporting.

### Container States

Within a Pod, each container has its own state:

- **Waiting**: Not started yet (pulling image, waiting for init containers)
- **Running**: Executing
- **Terminated**: Finished (either success or failure)

Check container states:

```bash
kubectl describe pod my-pod
```

Look for the `State` field under each container.

### Common Pending Reasons

```bash
kubectl describe pod stuck-pod
```

| Event Message | Meaning |
|--------------|---------|
| `0/3 nodes are available: insufficient memory` | No node has enough RAM |
| `0/3 nodes are available: 3 node(s) had taint` | Taints block scheduling |
| `FailedScheduling` | Scheduler can't place the Pod |
| `ImagePullBackOff` | Can't pull the container image |
| `ErrImagePull` | Image doesn't exist or auth failed |
| `CrashLoopBackOff` | Container keeps crashing and restarting |
| `CreateContainerConfigError` | Bad config (missing ConfigMap, Secret) |

---

## Restart Policies

Controls what happens when a container exits.

| Policy | Behavior | Use Case |
|--------|----------|----------|
| `Always` | Always restart (default) | Long-running services (APIs, workers) |
| `OnFailure` | Restart only on non-zero exit | Jobs that might fail |
| `Never` | Never restart | One-shot scripts |

The restart uses exponential backoff: 10s, 20s, 40s, 80s, ... up to 5 minutes. This prevents a crash loop from consuming resources.

```bash
kubectl get pods
```

If you see `CrashLoopBackOff`, the container is crashing and Kubernetes is waiting longer between each restart. Check logs:

```bash
kubectl logs my-pod --previous
```

`--previous` shows logs from the last crashed instance — crucial for debugging crashes.

---

## Hands-On: Working with Pods

### Setup

```bash
kind create cluster --name pods-lab
```

### Create a Pod with kubectl run

```bash
kubectl run my-nginx --image=nginx:1.25
```

This is the imperative way. Quick for testing, not for production (use Deployments instead).

```bash
kubectl get pods

kubectl get pod my-nginx -o wide

kubectl describe pod my-nginx
```

### Generate YAML without creating

```bash
kubectl run my-api --image=nginx:1.25 --port=8080 --dry-run=client -o yaml
```

This outputs the YAML that `kubectl run` would create. Save it, modify it, apply it.

### Create a Pod from YAML

Save this as `pod-go-api.yaml`:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: go-api-test
  labels:
    app: go-api
    env: test
spec:
  restartPolicy: Always
  containers:
    - name: api
      image: hashicorp/http-echo:latest
      args:
        - "-text=hello from kubernetes"
        - "-listen=:8080"
      ports:
        - containerPort: 8080
      resources:
        requests:
          cpu: 50m
          memory: 32Mi
        limits:
          cpu: 100m
          memory: 64Mi
```

```bash
kubectl apply -f pod-go-api.yaml

kubectl get pod go-api-test

kubectl describe pod go-api-test
```

### Exec into a Pod

```bash
kubectl exec -it my-nginx -- /bin/bash

ls /usr/share/nginx/html/
cat /etc/nginx/nginx.conf
curl localhost:80
exit
```

For minimal images without bash:

```bash
kubectl exec -it my-nginx -- /bin/sh
```

### Check logs

```bash
kubectl logs my-nginx

kubectl logs my-nginx -f

kubectl logs my-nginx --tail=20
```

### Port forward to test locally

```bash
kubectl port-forward pod/go-api-test 8080:8080
```

In another terminal:

```bash
curl http://localhost:8080
```

### See resource usage

```bash
kubectl top pod my-nginx
```

(Requires metrics-server — see the reference sheet for installation.)

### Delete Pods

```bash
kubectl delete pod my-nginx

kubectl delete pod go-api-test

kubectl delete pod my-nginx --grace-period=0 --force
```

### Watch Pod events in real time

```bash
kubectl get pods -w
```

In another terminal, create and delete Pods and watch the events stream.

---

## Hands-On: Multi-Container Pod

Save as `sidecar-pod.yaml`:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: sidecar-demo
spec:
  volumes:
    - name: shared-data
      emptyDir: {}
  containers:
    - name: writer
      image: busybox:1.36
      command:
        - sh
        - -c
        - |
          while true; do
            echo "$(date) - Hello from writer" >> /data/output.log
            sleep 5
          done
      volumeMounts:
        - name: shared-data
          mountPath: /data

    - name: reader
      image: busybox:1.36
      command:
        - sh
        - -c
        - tail -f /data/output.log
      volumeMounts:
        - name: shared-data
          mountPath: /data
          readOnly: true
```

```bash
kubectl apply -f sidecar-pod.yaml

kubectl logs sidecar-demo -c reader -f

kubectl exec sidecar-demo -c writer -- cat /data/output.log

kubectl exec sidecar-demo -c reader -- ls /data/
```

Notice:
- Both containers see the same `/data` directory
- The writer writes, the reader reads — shared filesystem
- They share `localhost` — if the writer ran an HTTP server, the reader could reach it at `localhost`

---

## Hands-On: Init Container

Save as `init-pod.yaml`:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: init-demo
spec:
  initContainers:
    - name: setup
      image: busybox:1.36
      command:
        - sh
        - -c
        - |
          echo "Running initialization..."
          sleep 5
          echo "Setup complete" > /work/status
      volumeMounts:
        - name: work-dir
          mountPath: /work

  containers:
    - name: app
      image: busybox:1.36
      command:
        - sh
        - -c
        - |
          echo "Init status: $(cat /work/status)"
          echo "App is running"
          sleep 3600
      volumeMounts:
        - name: work-dir
          mountPath: /work

  volumes:
    - name: work-dir
      emptyDir: {}
```

```bash
kubectl apply -f init-pod.yaml

kubectl get pod init-demo -w
```

Watch the phases:
1. `Init:0/1` — init container running
2. `PodInitializing` — init done, main container starting
3. `Running` — app is running

```bash
kubectl logs init-demo -c setup

kubectl logs init-demo -c app

kubectl exec init-demo -c app -- cat /work/status
```

The app container can read the file the init container created.

---

## What Would Happen If...

**...you created a Pod (not a Deployment) and the Pod crashed?**

It depends on `restartPolicy`:
- `Always`: kubelet restarts the container (with backoff). The Pod stays on the same node.
- `Never`: The Pod enters `Failed` state. It stays there until you delete it.
- `OnFailure`: Restarts on non-zero exit code. Stays failed on exit code 0.

Crucially: a bare Pod never gets rescheduled to another node. If the node dies, the Pod is gone forever. This is why you always use Deployments in production.

**...you set memory limit to 64Mi but your Go binary uses 100Mi?**

The Linux OOM (Out Of Memory) killer terminates the process. The container exits with code 137 (128 + 9, where 9 is SIGKILL). kubelet restarts the container. It uses 100Mi again. OOM killed again. This repeats with exponential backoff. You'll see `CrashLoopBackOff` with `OOMKilled` as the reason.

```bash
kubectl describe pod my-pod
```

Look for `Last State: Terminated, Reason: OOMKilled`.

Fix: increase the memory limit to accommodate your actual usage.

**...your readiness probe failed but liveness probe passed?**

The container stays running (liveness is fine), but the Pod is removed from Service endpoints. No traffic is routed to it. This is the correct behavior when your app is alive but temporarily can't handle requests (e.g., database connection lost, cache warming).

Once the readiness probe passes again, the Pod is added back to Service endpoints.

**...you exec'd into a Pod and changed a file?**

The change is local to that container's filesystem. If the container restarts, the change is lost (container images are read-only layers; changes go to a writable layer that's ephemeral). If you need persistent changes, use a volume.

**...both containers in a multi-container Pod need port 8080?**

They share the same network namespace, so you'd get a port conflict — just like two processes on your laptop both trying to bind port 8080. The second container would fail to start. Use different ports.

---

## Pod Design Patterns for Go/TypeScript

### Go API with Graceful Shutdown

Your Go API should handle SIGTERM for graceful shutdown. Kubernetes sends SIGTERM when terminating a Pod, then waits `terminationGracePeriodSeconds` (default 30s) before sending SIGKILL.

```yaml
spec:
  terminationGracePeriodSeconds: 60
  containers:
    - name: api
      image: my-go-api:v1
```

Your Go code should catch SIGTERM and drain connections:

```go
ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM)
defer stop()

server := &http.Server{Addr: ":8080"}
go server.ListenAndServe()

<-ctx.Done()
shutdownCtx, cancel := context.WithTimeout(context.Background(), 55*time.Second)
defer cancel()
server.Shutdown(shutdownCtx)
```

Set `terminationGracePeriodSeconds` slightly longer than your shutdown timeout.

### TypeScript/Node.js API

Same concept for Node.js — handle SIGTERM:

```typescript
process.on('SIGTERM', () => {
  server.close(() => {
    process.exit(0);
  });
});
```

### Debug Container

Need to debug a running Pod that has a minimal image (no shell)?

```bash
kubectl debug -it my-pod --image=busybox --target=api
```

This attaches a debug container to the Pod, sharing the same process namespace.

---

## Exercises

1. **Create a Pod that crashes.** Use `command: ["exit", "1"]` in a busybox container. Watch the CrashLoopBackOff behavior. Check `kubectl describe pod` to see restart counts and backoff timing.

2. **Create a Pod with resource limits too low.** Set memory limit to 4Mi for an nginx container. Watch it get OOM killed. Check the termination reason.

3. **Build a 3-container Pod.** One writes data, one transforms it, one reads the transformed data. Use `emptyDir` volumes to share data between them. Verify each container can only see what it should.

4. **Create a Pod with a failing readiness probe.** Set the readiness probe to check a path that doesn't exist (`/nonexistent`). Create a Service pointing to the Pod. Verify the Service has no endpoints:

```bash
kubectl get endpoints my-service
```

5. **Measure startup time.** Create Pods with and without init containers. Compare how long each takes to reach `Running` state. Use `kubectl get pod -o jsonpath='{.status.conditions}'` to see exact timestamps.

---

## Key Takeaways

- Pods are the smallest deployable unit — wrappers around one or more containers
- Containers in a Pod share network (localhost) and storage (volumes)
- Init containers run before main containers — use them for setup and dependency waiting
- Three probes: liveness (alive?), readiness (ready for traffic?), startup (started yet?)
- Resource requests = guaranteed minimum; limits = enforced maximum
- Bare Pods don't self-heal across nodes — always use Deployments in production
- CrashLoopBackOff means the container keeps crashing — check logs with `--previous`

Next: Deployments — the right way to run Pods in production.
