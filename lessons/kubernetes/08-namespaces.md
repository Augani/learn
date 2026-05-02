# Namespaces

## The Office Building Analogy

Think of a Kubernetes cluster as an office building. Namespaces are the floors.

Each floor has its own resources — desks, printers, meeting rooms. Teams on one floor don't see what's happening on other floors. But they're all in the same building, sharing the same elevator (network), the same front desk (API server), and the same address.

Floor 3 (the backend team) might have 50 desks. Floor 5 (the data team) might have 100 desks. Each floor has its own budget. If the data team runs out of desk space, they can't take desks from the backend floor.

Namespaces provide:
- **Isolation**: Resources in one namespace don't collide with resources in another
- **Organization**: Group related resources together
- **Access control**: RBAC can restrict who can access which namespace
- **Resource budgets**: ResourceQuotas limit how much each namespace can consume

---

## Default Namespaces

Every cluster starts with these namespaces:

```bash
kubectl get namespaces
```

```
NAME              STATUS   AGE
default           Active   1d
kube-system       Active   1d
kube-public       Active   1d
kube-node-lease   Active   1d
```

**default**: Where your resources go if you don't specify a namespace. Fine for learning, not for production.

**kube-system**: Kubernetes system components — API server, controller manager, CoreDNS, kube-proxy. Don't put your stuff here.

**kube-public**: Readable by everyone (even unauthenticated users). Rarely used. Contains cluster info.

**kube-node-lease**: Node heartbeat data. Helps detect node failures faster. You'll never interact with it directly.

---

## Why Use Namespaces?

### Without namespaces

Everything lives in `default`. You have:
- `api` (backend team)
- `api` (data team) ← name collision!
- `redis` (shared? whose redis?)
- 200 Pods with no organization

It's like an open-plan office with no walls — everyone's stuff is mixed together.

### With namespaces

```
namespace: backend
  - api
  - worker
  - redis

namespace: data
  - api
  - pipeline
  - redis

namespace: monitoring
  - prometheus
  - grafana
```

Each team can name their resources whatever they want without collisions. `api` in `backend` is a completely different resource from `api` in `data`.

---

## When to Use Namespaces

| Strategy | When to Use |
|----------|-------------|
| Per team | `backend`, `frontend`, `data`, `platform` |
| Per environment | `dev`, `staging`, `production` |
| Per project | `project-alpha`, `project-beta` |
| Per service group | `payments`, `notifications`, `auth` |

For small teams: per-environment namespaces work well. Dev, staging, and production in the same cluster (or separate clusters for production).

For larger organizations: per-team namespaces. Each team manages their own namespace with their own resource budgets.

### What namespaces DON'T isolate

Namespaces are a soft boundary, not a hard one:
- **Network**: By default, Pods in any namespace can reach Pods in any other namespace. (Use NetworkPolicies to restrict this.)
- **Nodes**: Pods from all namespaces share the same nodes.
- **Cluster-scoped resources**: Nodes, PersistentVolumes, StorageClasses, and ClusterRoles are NOT namespaced.

For true isolation (security, compliance), use separate clusters.

---

## Working with Namespaces

### Create a namespace

```bash
kubectl create namespace backend

kubectl create ns staging
```

Or from YAML:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: backend
  labels:
    team: backend
    env: production
```

### Set your default namespace

Instead of typing `-n backend` every time:

```bash
kubectl config set-context --current --namespace=backend
```

Now all commands target `backend` until you switch again.

### Deploy to a specific namespace

```bash
kubectl create deployment api --image=my-api:v1 -n backend

kubectl get pods -n backend

kubectl get pods -n staging
```

Or in YAML:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
        - name: api
          image: my-api:v1
```

### See resources across all namespaces

```bash
kubectl get pods -A

kubectl get all -A

kubectl get svc --all-namespaces
```

### Delete a namespace

```bash
kubectl delete namespace staging
```

This deletes the namespace AND everything in it — all Pods, Services, Deployments, ConfigMaps, Secrets. It's irreversible.

---

## Cross-Namespace Communication

Pods in different namespaces can communicate using the fully-qualified DNS name:

```
<service-name>.<namespace>.svc.cluster.local
```

From a Pod in the `frontend` namespace, reaching the `api` Service in the `backend` namespace:

```go
resp, err := http.Get("http://api.backend:80/users")
```

```typescript
const resp = await fetch('http://api.backend:80/users');
```

The short form `api.backend` works within the cluster. The full form `api.backend.svc.cluster.local` is explicit and always works.

Within the same namespace, just use the service name:

```go
resp, err := http.Get("http://api:80/users")
```

This resolves to `api.<current-namespace>.svc.cluster.local`.

---

## ResourceQuotas

ResourceQuotas set hard limits on what a namespace can consume. Like a departmental budget.

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: backend-quota
  namespace: backend
spec:
  hard:
    requests.cpu: "10"
    requests.memory: 20Gi
    limits.cpu: "20"
    limits.memory: 40Gi
    pods: "50"
    services: "20"
    configmaps: "50"
    secrets: "50"
    persistentvolumeclaims: "10"
    replicationcontrollers: "20"
    services.loadbalancers: "2"
    services.nodeports: "5"
```

Once a quota is set, every Pod in the namespace **must** specify resource requests and limits. If they don't, the Pod is rejected.

### Check quota usage

```bash
kubectl describe quota backend-quota -n backend
```

```
Name:                   backend-quota
Namespace:              backend
Resource                Used    Hard
--------                ----    ----
configmaps              3       50
limits.cpu              2500m   20
limits.memory           1536Mi  40Gi
pods                    5       50
requests.cpu            500m    10
requests.memory         640Mi   20Gi
services                2       20
```

When the namespace hits a limit, new resource creation is blocked until something is freed up. The error is clear:

```
Error from server (Forbidden): exceeded quota: backend-quota,
requested: pods=1, used: pods=50, limited: pods=50
```

---

## LimitRanges

ResourceQuotas cap the total. LimitRanges set per-Pod and per-container defaults and bounds.

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: default-limits
  namespace: backend
spec:
  limits:
    - type: Container
      default:
        cpu: 500m
        memory: 256Mi
      defaultRequest:
        cpu: 100m
        memory: 128Mi
      min:
        cpu: 50m
        memory: 64Mi
      max:
        cpu: 2000m
        memory: 2Gi
    - type: Pod
      max:
        cpu: 4000m
        memory: 4Gi
    - type: PersistentVolumeClaim
      min:
        storage: 1Gi
      max:
        storage: 50Gi
```

- `default`: If a container doesn't specify limits, these are applied.
- `defaultRequest`: If a container doesn't specify requests, these are applied.
- `min/max`: Hard bounds. A container requesting 3000m CPU is rejected (max is 2000m).

LimitRanges solve the "someone deployed a Pod without resource limits and it ate the whole node" problem.

### Use ResourceQuota + LimitRange together

- **LimitRange** ensures every container has sensible defaults and can't request absurd amounts
- **ResourceQuota** ensures the total consumption of the namespace stays within budget

They're complementary. Use both.

---

## Hands-On: Namespace Isolation

### Setup

```bash
kind create cluster --name ns-lab
```

### Create namespaces for two teams

```bash
kubectl create namespace team-backend
kubectl create namespace team-data
```

### Deploy apps in each namespace

```bash
kubectl create deployment api --image=hashicorp/http-echo:latest -n team-backend -- -text="backend api" -listen=:8080

kubectl expose deployment api --port=80 --target-port=8080 -n team-backend

kubectl create deployment api --image=hashicorp/http-echo:latest -n team-data -- -text="data api" -listen=:8080

kubectl expose deployment api --port=80 --target-port=8080 -n team-data
```

Notice: both are named `api`. No collision because they're in different namespaces.

### Verify isolation

```bash
kubectl get deployments -n team-backend
kubectl get deployments -n team-data
kubectl get deployments -n default
```

Each namespace only shows its own resources.

### Cross-namespace communication

```bash
kubectl run test -n team-backend --image=curlimages/curl --rm -it --restart=Never -- sh -c '
  echo "=== Calling api in own namespace ==="
  curl -s http://api:80
  echo ""
  echo "=== Calling api in team-data namespace ==="
  curl -s http://api.team-data:80
  echo ""
'
```

Both work. Same-namespace uses the short name. Cross-namespace uses `<svc>.<namespace>`.

### DNS resolution

```bash
kubectl run dns-test -n team-backend --image=busybox:1.36 --rm -it --restart=Never -- nslookup api.team-data.svc.cluster.local
```

---

## Hands-On: ResourceQuotas

### Apply a quota

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: team-backend-quota
  namespace: team-backend
spec:
  hard:
    requests.cpu: "1"
    requests.memory: 1Gi
    limits.cpu: "2"
    limits.memory: 2Gi
    pods: "10"
    services: "5"
```

```bash
kubectl apply -f quota.yaml
```

### Apply a LimitRange (so containers have defaults)

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: default-limits
  namespace: team-backend
spec:
  limits:
    - type: Container
      default:
        cpu: 200m
        memory: 256Mi
      defaultRequest:
        cpu: 100m
        memory: 128Mi
```

```bash
kubectl apply -f limitrange.yaml
```

### Deploy within quota

```bash
kubectl create deployment worker --image=busybox:1.36 -n team-backend -- sleep 3600

kubectl scale deployment worker --replicas=5 -n team-backend

kubectl get pods -n team-backend
```

### Exceed the quota

```bash
kubectl scale deployment worker --replicas=20 -n team-backend

kubectl get events -n team-backend --sort-by=.lastTimestamp
```

You'll see events like: "exceeded quota: team-backend-quota, requested: pods=1, used: pods=10, limited: pods=10"

The Deployment wants 20 replicas but can only create 10.

### Check quota usage

```bash
kubectl describe quota team-backend-quota -n team-backend
```

---

## Hands-On: LimitRange Enforcement

### Try to deploy without resource limits (before LimitRange)

Delete the LimitRange first:

```bash
kubectl delete limitrange default-limits -n team-backend
```

Try to deploy a Pod without resource specs:

```bash
kubectl run bare-pod --image=busybox:1.36 -n team-backend -- sleep 3600
```

This fails because ResourceQuota requires all Pods to have resource requests/limits, and we didn't specify any.

### Re-apply LimitRange

```bash
kubectl apply -f limitrange.yaml
```

```bash
kubectl run bare-pod --image=busybox:1.36 -n team-backend -- sleep 3600

kubectl describe pod bare-pod -n team-backend | grep -A 5 Limits
```

The LimitRange injected default limits. The Pod now has `cpu: 200m, memory: 256Mi` limits even though you didn't specify them.

### Test max limits

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: greedy-pod
  namespace: team-backend
spec:
  containers:
    - name: app
      image: busybox:1.36
      command: ["sleep", "3600"]
      resources:
        requests:
          cpu: 5000m
          memory: 8Gi
```

```bash
kubectl apply -f greedy-pod.yaml
```

Rejected: "cpu max limit is 2000m" or "exceeds quota."

---

## Namespace Patterns

### Dev/Staging/Production in one cluster

```bash
kubectl create ns dev
kubectl create ns staging
kubectl create ns production
```

Apply strict quotas to dev and staging, generous quotas to production. Developers deploy to dev freely, staging deployments go through CI, production deployments require approval.

### Per-team namespaces

```bash
kubectl create ns team-backend
kubectl create ns team-frontend
kubectl create ns team-data
kubectl create ns team-platform
```

Each team owns their namespace. Platform team manages shared infrastructure (monitoring, logging, ingress controllers) in dedicated namespaces.

### Namespace per microservice (usually too granular)

```bash
kubectl create ns auth-service
kubectl create ns user-service
kubectl create ns payment-service
```

This gets unwieldy with many services. Better to group related services in one namespace.

### The golden rule

Start with fewer namespaces and split as needed. 3-5 namespaces is fine for most teams. 50 namespaces means you're probably over-organizing.

---

## Namespace-Scoped vs. Cluster-Scoped Resources

| Namespaced (most things) | Cluster-scoped |
|--------------------------|---------------|
| Pods, Deployments, Services | Nodes |
| ConfigMaps, Secrets | PersistentVolumes |
| PVCs, Ingresses | StorageClasses |
| Roles, RoleBindings | ClusterRoles, ClusterRoleBindings |
| ServiceAccounts | Namespaces themselves |
| NetworkPolicies | CustomResourceDefinitions |

To see which resources are namespaced:

```bash
kubectl api-resources --namespaced=true

kubectl api-resources --namespaced=false
```

---

## What Would Happen If...

**...you deployed to the wrong namespace?**

The deployment works fine — it's just in the wrong place. Your Service in the correct namespace can't find the Pods (different namespace = different label scope). Use `-n` or set your context to avoid this.

```bash
kubectl config set-context --current --namespace=team-backend
```

**...you deleted a namespace?**

Everything in it is deleted — Pods, Services, Deployments, ConfigMaps, Secrets, PVCs. It cascades. The namespace enters `Terminating` state while all resources are cleaned up.

If deletion gets stuck (happens sometimes), there might be a finalizer that can't complete:

```bash
kubectl get namespace stuck-ns -o yaml
```

Look for `finalizers` and remove them (carefully).

**...Pod A in namespace X tried to reach Pod B in namespace Y?**

By default, it works. Kubernetes networking is flat — any Pod can reach any other Pod across namespaces. To restrict this, use NetworkPolicies.

**...you exceeded a ResourceQuota?**

New resource creation in that namespace is blocked. Existing resources keep running. The error message tells you which limit was hit. Free up resources or increase the quota.

**...two teams both wanted the `default` namespace?**

Chaos. Resources would collide. There's no ownership. No resource isolation. This is why `default` should only be used for experimentation, never for real workloads.

---

## Namespace Labels and Annotations

Label your namespaces for organization and policy enforcement:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: team-backend
  labels:
    team: backend
    env: production
    cost-center: "CC-1234"
  annotations:
    owner: "backend-team@company.com"
    slack-channel: "#backend-alerts"
```

Labels enable:
- NetworkPolicies that apply to entire namespaces (`namespaceSelector`)
- RBAC that targets namespaces by label
- Cost allocation (tag resources by team/cost-center)
- Policy enforcement (OPA/Gatekeeper can enforce rules per label)

---

## Cleaning Up Namespaces

### Delete all resources in a namespace without deleting the namespace

```bash
kubectl delete all --all -n team-backend
```

`all` doesn't actually mean all — it covers Pods, Services, Deployments, ReplicaSets, etc., but NOT ConfigMaps, Secrets, PVCs, or Roles. For a true clean sweep:

```bash
kubectl delete all,configmaps,secrets,pvc --all -n team-backend
```

### Delete stale namespaces

```bash
kubectl get ns --show-labels

kubectl delete ns old-project
```

---

## Exercises

1. **Namespace collision test.** Create two namespaces. Deploy a Deployment named `api` in both. Create a Service named `api` in both. Verify they're completely independent — different Pods, different endpoints.

2. **Cross-namespace service call.** Deploy a "frontend" in namespace A and a "backend" in namespace B. Have the frontend call the backend using `<service>.<namespace>` DNS. Verify it works.

3. **ResourceQuota enforcement.** Create a namespace with a quota of 5 pods max. Deploy a Deployment with 3 replicas. Try scaling to 10. Observe which pods get created and which are blocked. Check events for the quota error messages.

4. **LimitRange defaults.** Create a namespace with a LimitRange. Deploy a Pod without any resource specifications. Describe the Pod and verify the LimitRange injected default values.

5. **Namespace cleanup.** Create a namespace with multiple resources (Deployment, Service, ConfigMap, Secret, PVC). Delete the namespace. Verify everything was cleaned up. Time how long the deletion takes.

---

## Key Takeaways

- Namespaces partition a cluster into logical groups — like floors in a building
- Resources in different namespaces can have the same name without conflict
- Cross-namespace communication uses `<service>.<namespace>` DNS
- ResourceQuotas limit total resource consumption per namespace
- LimitRanges set per-container defaults and bounds
- Use ResourceQuota + LimitRange together for proper resource governance
- Network traffic crosses namespaces by default — use NetworkPolicies to restrict
- Don't over-namespace — 3-5 namespaces is enough for most teams
- Deleting a namespace deletes everything in it

Next: Kubernetes networking — how Pods actually communicate.
