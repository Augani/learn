# ReplicaSets and Deployments

## The Restaurant Chain Analogy

Imagine you own a restaurant chain. Your playbook says: "We always have 3 locations open, each serving the same menu."

- If one location burns down, you open a new one immediately.
- When you update the menu, you don't close all locations at once. You update one at a time — Location A gets the new menu, customers keep going to B and C. Once A is serving fine, update B. Then C.
- If the new menu is terrible (customers complain), you roll back to the old menu at all locations.
- During the holiday season, you temporarily open 2 more locations to handle demand.

A **Deployment** in Kubernetes is that playbook. A **ReplicaSet** is the manager who ensures the right number of locations are open with the right menu version.

---

## ReplicaSet: Ensuring N Copies Run

A ReplicaSet has one job: make sure exactly N copies of a Pod are running at all times.

```yaml
apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: my-api-rs
spec:
  replicas: 3
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
          image: my-api:v1
          ports:
            - containerPort: 8080
```

The ReplicaSet controller runs a reconciliation loop:

```
current_pods = count pods with label app=my-api owned by this ReplicaSet
desired_pods = 3

if current_pods < desired_pods:
    create (desired - current) pods
elif current_pods > desired_pods:
    delete (current - desired) pods
```

That's it. Create or delete Pods to match the desired count.

**You almost never create ReplicaSets directly.** Deployments create and manage them for you. The ReplicaSet is an implementation detail — like how a Go channel is backed by a ring buffer. You use the channel, not the buffer.

Why learn about them at all? Because understanding ReplicaSets explains how Deployments do rolling updates (they create a new ReplicaSet and scale it up while scaling the old one down).

---

## Deployment: The Complete Package

A Deployment adds rollout management on top of ReplicaSets:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-api
  namespace: default
spec:
  replicas: 3
  revisionHistoryLimit: 10
  selector:
    matchLabels:
      app: my-api
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app: my-api
    spec:
      containers:
        - name: api
          image: my-api:v1.0.0
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

### The selector → template connection

This trips up beginners. The `selector.matchLabels` must match the `template.metadata.labels`. The Deployment uses the selector to find which Pods belong to it.

```
selector:
  matchLabels:
    app: my-api        ← "I manage Pods with this label"
template:
  metadata:
    labels:
      app: my-api      ← "Pods I create will have this label"
```

If these don't match, the Deployment can't find its own Pods. Kubernetes validates this and rejects the manifest.

### Strategy Types

**RollingUpdate** (default): Replace Pods one at a time. Zero downtime.

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1        # allow 1 extra Pod during update (3+1=4 max)
    maxUnavailable: 0  # never have fewer than 3 running
```

**Recreate**: Kill all old Pods first, then create new ones. There will be downtime.

```yaml
strategy:
  type: Recreate
```

Use Recreate when:
- Your app can't run two versions simultaneously (database schema conflicts)
- You have a volume that can only be mounted by one Pod (ReadWriteOnce)
- Downtime is acceptable and you want the fastest update

For Go/TypeScript APIs: always use RollingUpdate. If your API can handle requests from both v1 and v2 simultaneously (and it should — design your APIs to be backward compatible), RollingUpdate gives you zero-downtime deploys.

### maxSurge and maxUnavailable

These control the speed and safety of rolling updates.

With `replicas: 3`:

| maxSurge | maxUnavailable | During Update | Behavior |
|----------|---------------|---------------|----------|
| 1 | 0 | 3-4 pods running | Safe but slow. Always at least 3 available. |
| 0 | 1 | 2-3 pods running | No extra pods, but allows 1 to be down. |
| 1 | 1 | 2-4 pods running | Balanced. Fast updates. |
| 25% | 25% | 2-4 pods running | Percentage-based (default). |

For production Go APIs that need zero downtime:
```yaml
maxSurge: 1
maxUnavailable: 0
```

This means Kubernetes always has at least 3 healthy Pods. It creates a 4th with the new version, waits for it to pass readiness, then kills one old Pod. Repeat until all are updated.

---

## How Rolling Updates Work

Let's trace a version update step by step. You have my-api:v1 running with 3 replicas.

```bash
kubectl set image deployment/my-api api=my-api:v2
```

**Step 1**: Deployment controller creates a new ReplicaSet for v2 with 0 replicas.

```
ReplicaSet v1: 3/3 pods running
ReplicaSet v2: 0/0 pods running
```

**Step 2**: Scale up v2 by maxSurge (1).

```
ReplicaSet v1: 3/3 pods running
ReplicaSet v2: 1/1 pod running (waiting for readiness)
```

**Step 3**: v2 Pod passes readiness probe. Scale down v1 by 1.

```
ReplicaSet v1: 2/2 pods running (1 terminating)
ReplicaSet v2: 1/1 pod running
```

**Step 4**: Repeat. Scale up v2 by 1.

```
ReplicaSet v1: 2/2 pods running
ReplicaSet v2: 2/2 pods running (1 new, waiting for readiness)
```

**Step 5**: v2 Pod ready. Scale down v1 by 1.

```
ReplicaSet v1: 1/1 pod running
ReplicaSet v2: 2/2 pods running
```

**Step 6**: Scale up v2, scale down v1.

```
ReplicaSet v1: 0/0 pods running (kept for rollback history)
ReplicaSet v2: 3/3 pods running ✓
```

The old ReplicaSet (v1) is kept with 0 replicas so you can roll back to it later. The `revisionHistoryLimit` controls how many old ReplicaSets to keep.

This is why readiness probes are critical. Without them, Kubernetes has no way to know if the new version is actually working. It would scale up v2 and scale down v1 blindly, potentially routing traffic to broken Pods.

---

## Desired State Reconciliation

The Deployment controller is constantly comparing desired state to actual state. This is the core concept.

You say: "I want 3 replicas of my-api:v2."

| Scenario | Desired | Actual | Action |
|----------|---------|--------|--------|
| Normal | 3 running | 3 running | Nothing |
| Pod crashed | 3 running | 2 running | Create 1 more |
| Node died | 3 running | 1 running | Create 2 more on other nodes |
| Manual scale | 5 running | 3 running | Create 2 more |
| Scale down | 2 running | 5 running | Delete 3 |
| Image update | 3 of v2 | 3 of v1 | Rolling update |

You never say "start a Pod" or "stop that Pod." You say "I want this state" and the controller makes it so. Like telling a thermostat "keep it at 72 degrees" instead of "turn on the heater now."

This is the same model React uses for the DOM. You declare the UI state, React diffs and patches. You declare the cluster state, Kubernetes diffs and patches.

---

## Hands-On: Create and Manage a Deployment

### Setup

```bash
kind create cluster --name deploy-lab
```

### Create a Deployment

```bash
kubectl create deployment web --image=nginx:1.24 --replicas=3
```

```bash
kubectl get deployments

kubectl get replicasets

kubectl get pods
```

Notice the naming hierarchy:
- Deployment: `web`
- ReplicaSet: `web-<hash>` (e.g., `web-7d9f8b6c4a`)
- Pods: `web-<rs-hash>-<pod-hash>` (e.g., `web-7d9f8b6c4a-x2k9p`)

The ReplicaSet hash comes from hashing the Pod template. Different template = different hash = different ReplicaSet.

### Inspect the Deployment

```bash
kubectl describe deployment web

kubectl get deployment web -o yaml
```

Look at the `status` section:

```yaml
status:
  availableReplicas: 3
  readyReplicas: 3
  replicas: 3
  updatedReplicas: 3
```

### Kill a Pod and Watch Self-Healing

Terminal 1:
```bash
kubectl get pods -w
```

Terminal 2:
```bash
kubectl delete pod $(kubectl get pods -l app=web -o jsonpath='{.items[0].metadata.name}')
```

In Terminal 1, you'll see:
1. The Pod enters `Terminating`
2. A new Pod appears in `ContainerCreating`
3. The new Pod becomes `Running`

The ReplicaSet noticed current=2, desired=3, and created a replacement.

### Scale the Deployment

```bash
kubectl scale deployment web --replicas=5

kubectl get pods

kubectl scale deployment web --replicas=2

kubectl get pods
```

Watch 2 Pods get created, then 3 get terminated.

```bash
kubectl get replicaset
```

The same ReplicaSet just changes its replica count. No new ReplicaSet needed because the Pod template didn't change.

---

## Hands-On: Rolling Update

### Update the image

```bash
kubectl get pods -w &

kubectl set image deployment/web nginx=nginx:1.25

kubectl rollout status deployment/web
```

Watch the output. You'll see:
- New Pods with a different ReplicaSet hash appearing
- Old Pods being terminated
- `rollout status` reporting progress

```bash
kubectl get replicasets
```

You now have two ReplicaSets:
- Old one: `nginx:1.24` with 0 replicas
- New one: `nginx:1.25` with 2 replicas (or whatever you scaled to)

### Check rollout history

```bash
kubectl rollout history deployment/web

kubectl rollout history deployment/web --revision=2
```

### Rollback

```bash
kubectl rollout undo deployment/web

kubectl rollout status deployment/web

kubectl get pods -o jsonpath='{.items[*].spec.containers[0].image}'
```

The Pods are back on `nginx:1.24`. Kubernetes did a rolling update in reverse — scaled up the old ReplicaSet, scaled down the new one.

### Rollback to a specific revision

```bash
kubectl rollout undo deployment/web --to-revision=2
```

### Pause and resume a rollout

```bash
kubectl set image deployment/web nginx=nginx:1.25

kubectl rollout pause deployment/web
```

The rollout stops mid-way. Some Pods are v1, some v2. This is useful for canary testing.

```bash
kubectl get pods -o custom-columns=NAME:.metadata.name,IMAGE:.spec.containers[0].image

kubectl rollout resume deployment/web
```

---

## Hands-On: From YAML

Save as `go-api-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: go-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: go-api
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app: go-api
        version: v1
    spec:
      terminationGracePeriodSeconds: 30
      containers:
        - name: api
          image: hashicorp/http-echo:latest
          args:
            - "-text=version 1"
            - "-listen=:8080"
          ports:
            - containerPort: 8080
          resources:
            requests:
              cpu: 50m
              memory: 32Mi
            limits:
              cpu: 200m
              memory: 64Mi
          readinessProbe:
            httpGet:
              path: /
              port: 8080
            initialDelaySeconds: 2
            periodSeconds: 5
          livenessProbe:
            httpGet:
              path: /
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 10
```

```bash
kubectl apply -f go-api-deployment.yaml

kubectl rollout status deployment/go-api

kubectl port-forward deployment/go-api 8080:8080 &

curl http://localhost:8080
```

Now update the version:

```bash
kubectl patch deployment go-api -p '{"spec":{"template":{"spec":{"containers":[{"name":"api","args":["-text=version 2","-listen=:8080"]}]}}}}'

kubectl rollout status deployment/go-api

curl http://localhost:8080
```

Alternatively, edit the YAML file and `kubectl apply -f go-api-deployment.yaml` again. This is the GitOps approach — your YAML files are the source of truth.

---

## Deployment Strategies Deep Dive

### Rolling Update (Zero Downtime)

Best for: stateless APIs, web servers, microservices.

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 0
```

Requirements for zero-downtime rolling updates:
1. **Readiness probes** — Kubernetes must know when the new Pod is ready
2. **Graceful shutdown** — Old Pods must drain connections before dying
3. **Backward compatibility** — Both versions may serve traffic simultaneously
4. **Database compatibility** — Both versions must work with the current schema

For Go APIs:

```go
srv := &http.Server{Addr: ":8080"}

go func() {
    <-ctx.Done()
    shutdownCtx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
    defer cancel()
    srv.Shutdown(shutdownCtx)
}()
```

Set `terminationGracePeriodSeconds` to a value larger than your shutdown timeout.

### Recreate (With Downtime)

Best for: single-instance databases, apps with RWO volumes, apps that can't run two versions.

```yaml
strategy:
  type: Recreate
```

All old Pods are killed before new ones start. Simple, but users see downtime.

### Blue-Green (Manual)

Not built into Deployments, but achievable with two Deployments and a Service:

```bash
kubectl apply -f deployment-blue.yaml
kubectl apply -f deployment-green.yaml
```

Service points to blue:
```yaml
selector:
  app: my-api
  color: blue
```

To switch: update the Service selector to `color: green`. Instant cutover. Rollback: switch back to `color: blue`.

### Canary (Manual)

Run a small percentage of traffic on the new version:

```bash
kubectl scale deployment my-api-v1 --replicas=9
kubectl scale deployment my-api-v2 --replicas=1
```

With a Service selecting `app: my-api` (no version label), traffic splits roughly 90/10. Monitor error rates. If good, scale v2 up and v1 down.

For proper traffic splitting, use a service mesh (Istio) or Ingress controller with canary annotations.

---

## Deployment vs. Other Workload Types

| Resource | Use Case | Example |
|----------|----------|---------|
| Deployment | Stateless apps, APIs | Go HTTP server, React frontend |
| StatefulSet | Stateful apps needing stable identity | PostgreSQL, Redis, Kafka |
| DaemonSet | One Pod per node | Log collectors, monitoring agents |
| Job | Run to completion | Database migrations, batch processing |
| CronJob | Scheduled tasks | Nightly backups, report generation |

If you're deploying a Go or TypeScript API, Deployment is almost always what you want.

---

## Common Issues and Debugging

### Deployment stuck on rollout

```bash
kubectl rollout status deployment/my-api
```

If it hangs, check:

```bash
kubectl get pods

kubectl describe pod <new-pod-name>

kubectl logs <new-pod-name>
```

Common causes:
- Image doesn't exist (`ImagePullBackOff`)
- App crashes on startup (`CrashLoopBackOff`)
- Readiness probe never passes (check the probe path and port)
- Insufficient resources (no node has enough CPU/memory)

### Rolling back a bad deploy

```bash
kubectl rollout undo deployment/my-api

kubectl rollout status deployment/my-api
```

### Checking revision history

```bash
kubectl rollout history deployment/my-api

kubectl rollout history deployment/my-api --revision=3

kubectl get replicasets -l app=my-api
```

Each ReplicaSet corresponds to a revision. The one with non-zero replicas is the current version.

### Force restart all Pods (same image)

```bash
kubectl rollout restart deployment/my-api
```

This triggers a rolling update even though the image hasn't changed. Useful when you need to pick up new ConfigMap values or rotate secrets.

---

## What Would Happen If...

**...you scaled a Deployment to 0?**

All Pods get terminated. The Deployment and ReplicaSet still exist (with desired=0). No traffic can be served. Scale back up to restore service.

```bash
kubectl scale deployment my-api --replicas=0
kubectl get pods  # none
kubectl scale deployment my-api --replicas=3
kubectl get pods  # 3 new pods
```

**...you deleted the ReplicaSet but not the Deployment?**

The Deployment controller would immediately create a new ReplicaSet. The Deployment owns the ReplicaSet — it's part of the reconciliation loop. You'd see a brief disruption as Pods get recreated.

**...you deployed an image that crashes immediately?**

The rolling update starts: a new Pod is created, it crashes, readiness probe never passes. With `maxUnavailable: 0`, the old Pods keep running. The rollout is stuck. No traffic is disrupted because the broken Pods never pass readiness, so the old Pods keep serving.

```bash
kubectl rollout status deployment/my-api
# waiting...

kubectl rollout undo deployment/my-api
# rolls back to working version
```

This is why `maxUnavailable: 0` is the safest setting. It guarantees the old version keeps running until the new one is proven healthy.

**...two Deployments had the same selector labels?**

Chaos. Both Deployments would try to manage the same Pods. They'd fight — one scales up, the other scales down. Always use unique selectors per Deployment.

**...you edited the Pod template in a Deployment?**

A new ReplicaSet is created and a rolling update begins. Any change to the template (even adding a label) triggers this. Changes outside the template (like changing `replicas`) don't create a new ReplicaSet.

---

## Production Checklist

Before deploying your Go/TypeScript API to production with a Deployment:

- [ ] **Readiness probe** configured and tested (not just liveness!)
- [ ] **Resource requests and limits** set based on actual usage data
- [ ] **At least 2 replicas** (preferably 3) for high availability
- [ ] **maxUnavailable: 0** to prevent downtime during updates
- [ ] **Graceful shutdown** handler in your code (SIGTERM)
- [ ] **terminationGracePeriodSeconds** set appropriately (> shutdown timeout)
- [ ] **Revision history limit** set (default 10 is usually fine)
- [ ] **Pod disruption budget** configured (advanced, for maintenance windows)
- [ ] **Anti-affinity rules** to spread Pods across nodes (so one node failure doesn't take all replicas)

---

## Exercises

1. **Simulate a bad deploy.** Create a deployment with nginx:1.25, then update to a non-existent image (`nginx:doesntexist`). Watch the rollout get stuck. Check Pod status. Roll back. Verify all Pods are healthy.

2. **Test maxSurge and maxUnavailable.** Create a Deployment with 5 replicas. Try different strategy configurations:
   - `maxSurge: 5, maxUnavailable: 0` (fast, but uses double resources)
   - `maxSurge: 0, maxUnavailable: 1` (slow, minimal resource usage)
   - `maxSurge: 2, maxUnavailable: 2` (balanced)

   Watch each rollout with `kubectl get pods -w` and note the speed and behavior.

3. **Build a blue-green deployment.** Create two Deployments (`my-api-blue` and `my-api-green`) with different response text. Create a Service that points to blue. Switch to green by changing the selector. Verify the switch is instant.

4. **Automate canary testing.** Deploy v1 with 9 replicas and v2 with 1 replica. Port forward to the Service and hit it 100 times. Count how many responses come from v1 vs v2. Scale v2 up gradually.

5. **Explore ReplicaSet history.** Deploy an app, update it 5 times with different images. Use `kubectl get rs` to see all the ReplicaSets. Use `kubectl rollout history` to see revision details. Roll back to revision 2.

---

## Key Takeaways

- ReplicaSets ensure N Pods are running; Deployments manage ReplicaSets
- Desired state reconciliation: you declare what you want, controllers make it happen
- Rolling updates replace Pods one at a time for zero downtime
- Readiness probes are essential — without them, rolling updates are blind
- `maxSurge: 1, maxUnavailable: 0` is the safest production configuration
- Rollbacks are instant — just reactivate an old ReplicaSet
- Never create bare Pods or ReplicaSets in production — always use Deployments

Next: Services — giving your Pods a stable address.
