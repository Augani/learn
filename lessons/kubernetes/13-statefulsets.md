# Lesson 13: StatefulSets — Databases and Ordered Workloads

## The Big Picture

A Deployment is like hiring interchangeable temps for a busy season. You need 5
workers, and any 5 will do. If one calls in sick, you get a replacement and it
doesn't matter who. They all do the same job, sit at whatever desk is free, and
have no personal storage. One temp is identical to another.

A StatefulSet is like hiring permanent staff. Each person gets an assigned desk
with a name plate ("Alice — Desk 1", "Bob — Desk 2"). They have personal
filing cabinets that stay with their desk even if they go on vacation. When
someone returns, they go back to their specific desk. New hires get the next
desk in sequence. If you downsize, the most recently hired person leaves first.

In Kubernetes terms: Deployments create interchangeable Pods with random names
and no persistent identity. StatefulSets create Pods with stable names
(`pod-0`, `pod-1`), stable network identities, and personal persistent storage
that survives Pod restarts.

---

## Prerequisites

- Lesson 04 (Deployments)
- Lesson 05 (Services)
- Lesson 07 (Volumes and PVCs)
- Lesson 11 (DNS — headless Services)

```bash
kind create cluster --name stateful-lab
```

---

## Why Deployments Aren't Enough for Databases

Consider a three-node PostgreSQL cluster with one primary and two replicas. The
replicas stream changes from the primary. This setup has specific requirements:

1. **Stable identity**: the primary is always `postgres-0`. Replicas know to
   connect to `postgres-0` for replication. If the primary Pod restarts, it
   must come back as `postgres-0`, not get a random new name.

2. **Stable network address**: replicas need a reliable DNS name for the
   primary. If the primary moves to a different node with a different IP, the
   DNS name must still work.

3. **Persistent storage per Pod**: each replica has its own data directory. If
   `postgres-1` restarts, it must reattach to its specific data volume, not
   get a fresh empty one or someone else's data.

4. **Ordered deployment**: the primary (`postgres-0`) must be fully running
   before the first replica (`postgres-1`) starts. The first replica must be
   ready before the second (`postgres-2`) starts.

5. **Ordered termination**: when scaling down from 3 to 2, `postgres-2` goes
   away first (not the primary).

Deployments guarantee none of these things. Pod names are random
(`postgres-7b4f9c-xk2lp`). Pods share PVCs or get new ones on restart. There's
no ordering. Deployments are deliberately designed for stateless workloads.

---

## StatefulSet Guarantees

| Feature | Deployment | StatefulSet |
|---------|-----------|-------------|
| Pod naming | Random suffix (`app-7b4f9c-xk2lp`) | Sequential ordinal (`app-0`, `app-1`) |
| Pod ordering | All created simultaneously | Created in order (0, 1, 2...) |
| Scale down order | Any Pod can be removed | Removed in reverse order (2, 1, 0) |
| Network identity | Random, changes on restart | Stable DNS per Pod |
| Storage | Shared or ephemeral | Dedicated PVC per Pod |
| Replacement behavior | New random Pod | Same name, same PVC |

---

## Building Blocks: Headless Service

StatefulSets require a **headless Service** (from Lesson 11). A headless
Service has `clusterIP: None` and creates individual DNS records for each Pod
instead of a single ClusterIP.

Without a headless Service, there's no way to reach a specific Pod by name. And
for databases, you need to reach specific Pods.

```yaml
# file: redis-headless.yaml
apiVersion: v1
kind: Service
metadata:
  name: redis
  labels:
    app: redis
spec:
  ports:
  - port: 6379
    name: redis
  clusterIP: None
  selector:
    app: redis
```

This creates DNS records like:
```
redis-0.redis.default.svc.cluster.local
redis-1.redis.default.svc.cluster.local
redis-2.redis.default.svc.cluster.local
```

---

## Your First StatefulSet

Let's deploy a 3-replica Redis cluster.

### Step 1: Storage

StatefulSets use `volumeClaimTemplates` — a template that creates a unique PVC
for each Pod. Unlike a Deployment where you define a PVC separately, the
StatefulSet stamps out one PVC per replica automatically.

### Step 2: The Full Manifest

```yaml
# file: redis-statefulset.yaml
apiVersion: v1
kind: Service
metadata:
  name: redis
  labels:
    app: redis
spec:
  ports:
  - port: 6379
    name: redis
  clusterIP: None
  selector:
    app: redis
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis
spec:
  serviceName: redis
  replicas: 3
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
          name: redis
        volumeMounts:
        - name: redis-data
          mountPath: /data
  volumeClaimTemplates:
  - metadata:
      name: redis-data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 1Gi
```

Key fields:

- **serviceName: redis** — must match the headless Service name. This is how
  the StatefulSet knows which Service provides its network identity.
- **volumeClaimTemplates** — creates a PVC named `redis-data-redis-0`,
  `redis-data-redis-1`, `redis-data-redis-2` — one per Pod.
- **replicas: 3** — creates `redis-0`, `redis-1`, `redis-2` in order.

```bash
kubectl apply -f redis-statefulset.yaml
```

### Step 3: Watch the Ordered Creation

```bash
kubectl get pods -w -l app=redis
```

```
NAME      READY   STATUS    RESTARTS   AGE
redis-0   0/1     Pending   0          2s
redis-0   0/1     ContainerCreating   0   3s
redis-0   1/1     Running   0          5s
redis-1   0/1     Pending   0          0s
redis-1   0/1     ContainerCreating   0   1s
redis-1   1/1     Running   0          3s
redis-2   0/1     Pending   0          0s
redis-2   0/1     ContainerCreating   0   1s
redis-2   1/1     Running   0          3s
```

Notice: `redis-0` becomes Running before `redis-1` starts. `redis-1` is
Running before `redis-2` starts. This is ordered deployment.

### Step 4: Verify Pod Names

```bash
kubectl get pods -l app=redis
```

```
NAME      READY   STATUS    RESTARTS   AGE
redis-0   1/1     Running   0          60s
redis-1   1/1     Running   0          55s
redis-2   1/1     Running   0          50s
```

Predictable, sequential names. Not random hashes.

### Step 5: Verify PVCs

```bash
kubectl get pvc
```

```
NAME                STATUS   VOLUME                                     CAPACITY   ACCESS MODES
redis-data-redis-0  Bound    pvc-abc123...                              1Gi        RWO
redis-data-redis-1  Bound    pvc-def456...                              1Gi        RWO
redis-data-redis-2  Bound    pvc-ghi789...                              1Gi        RWO
```

Each Pod has its own PVC. The naming convention is
`<volumeClaimTemplate-name>-<statefulset-name>-<ordinal>`.

---

## Stable Network Identity

### DNS Records

Start a debug Pod and test DNS:

```bash
kubectl run dnsutils --image=tutum/dnsutils --command -- sleep 3600
kubectl wait --for=condition=ready pod/dnsutils --timeout=60s
```

```bash
kubectl exec dnsutils -- nslookup redis-0.redis
```

```
Server:    10.96.0.10
Address:   10.96.0.10#53

Name:      redis-0.redis.default.svc.cluster.local
Address:   10.244.1.5
```

Each Pod has its own DNS name: `<pod-name>.<service-name>.<namespace>.svc.cluster.local`.

```bash
kubectl exec dnsutils -- nslookup redis-1.redis
kubectl exec dnsutils -- nslookup redis-2.redis
```

Each resolves to a different IP.

### Identity Survives Restarts

Delete a Pod and watch what happens:

```bash
kubectl delete pod redis-1
```

```bash
kubectl get pods -w -l app=redis
```

```
NAME      READY   STATUS    RESTARTS   AGE
redis-0   1/1     Running   0          5m
redis-1   0/1     Pending   0          2s
redis-2   1/1     Running   0          5m
redis-1   0/1     ContainerCreating   0   3s
redis-1   1/1     Running   0          5s
```

The replacement Pod is named `redis-1` — the same name. It gets the same PVC
(`redis-data-redis-1`). The DNS name `redis-1.redis` still works, though the
IP address may change.

This is the permanent staff analogy: when Bob (desk 2) takes a sick day, his
desk, name plate, and filing cabinet stay there. When he comes back (or a
replacement "Bob" is hired for desk 2), everything is exactly where it was.

---

## Stable Storage

Let's prove that data survives Pod restarts.

### Write Data to redis-0

```bash
kubectl exec redis-0 -- redis-cli SET mykey "hello from redis-0"
kubectl exec redis-0 -- redis-cli GET mykey
```

```
"hello from redis-0"
```

### Kill redis-0

```bash
kubectl delete pod redis-0
kubectl wait --for=condition=ready pod/redis-0 --timeout=60s
```

### Check the Data

```bash
kubectl exec redis-0 -- redis-cli GET mykey
```

```
"hello from redis-0"
```

The data survived because the new `redis-0` Pod reattached to the same PVC
(`redis-data-redis-0`) which still has the data directory from the previous
instance.

Compare this to a Deployment: if you delete a Pod, the replacement gets a new
name and either a new empty volume or a shared volume. There's no guarantee of
data continuity for a specific instance.

---

## Scaling StatefulSets

### Scale Up

```bash
kubectl scale statefulset redis --replicas=5
```

```bash
kubectl get pods -w -l app=redis
```

Pods `redis-3` and `redis-4` are created in order, after the existing Pods.

### Scale Down

```bash
kubectl scale statefulset redis --replicas=3
```

```bash
kubectl get pods -w -l app=redis
```

Pods are removed in reverse order: `redis-4` first, then `redis-3`. The
primary (`redis-0`) is always the last to go.

### PVCs Are NOT Deleted on Scale Down

```bash
kubectl get pvc
```

```
redis-data-redis-0  Bound    ...
redis-data-redis-1  Bound    ...
redis-data-redis-2  Bound    ...
redis-data-redis-3  Bound    ...
redis-data-redis-4  Bound    ...
```

The PVCs for `redis-3` and `redis-4` are still there even though the Pods are
gone. If you scale back up to 5, the new `redis-3` and `redis-4` Pods will
reattach to their existing PVCs with all the data intact.

This is by design — data is precious and should never be automatically deleted.
You must manually delete PVCs when you're sure you don't need the data.

---

## Update Strategies

### RollingUpdate (Default)

Updates Pods one at a time in reverse ordinal order (highest to lowest).

```yaml
spec:
  updateStrategy:
    type: RollingUpdate
    rollingUpdate:
      partition: 0
```

If you update the container image:

```bash
kubectl set image statefulset/redis redis=redis:7.2-alpine
```

The rollout updates `redis-2` first, waits for it to be ready, then `redis-1`,
then `redis-0`. This is the opposite of creation order, which makes sense for
databases — you update replicas before the primary.

### Partitioned Updates (Canary)

The `partition` field lets you do canary rollouts:

```yaml
spec:
  updateStrategy:
    type: RollingUpdate
    rollingUpdate:
      partition: 2
```

With `partition: 2`, only Pods with ordinal >= 2 get updated. Pods 0 and 1
keep the old version. This lets you test the update on `redis-2` before rolling
it to everyone.

```bash
kubectl patch statefulset redis -p '{"spec":{"updateStrategy":{"rollingUpdate":{"partition":2}}}}'
kubectl set image statefulset/redis redis=redis:7.2-alpine
```

Only `redis-2` gets the new image. Verify:

```bash
kubectl get pods -l app=redis -o jsonpath='{range .items[*]}{.metadata.name}: {.spec.containers[0].image}{"\n"}{end}'
```

```
redis-0: redis:7-alpine
redis-1: redis:7-alpine
redis-2: redis:7.2-alpine
```

Once you're confident, reduce the partition to 0 to update everyone:

```bash
kubectl patch statefulset redis -p '{"spec":{"updateStrategy":{"rollingUpdate":{"partition":0}}}}'
```

### OnDelete

Pods are only updated when you manually delete them:

```yaml
spec:
  updateStrategy:
    type: OnDelete
```

This gives you full control. You change the image, then delete Pods one by one
when you're ready.

---

## Real-World Example: Redis Cluster with Replication

Let's build a more realistic Redis setup where `redis-0` is the primary and the
others are replicas.

```yaml
# file: redis-cluster.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: redis-config
data:
  primary.conf: |
    bind 0.0.0.0
    port 6379
    dir /data
    appendonly yes
  replica.conf: |
    bind 0.0.0.0
    port 6379
    dir /data
    appendonly yes
    replicaof redis-0.redis 6379
---
apiVersion: v1
kind: Service
metadata:
  name: redis
spec:
  ports:
  - port: 6379
    name: redis
  clusterIP: None
  selector:
    app: redis
---
apiVersion: v1
kind: Service
metadata:
  name: redis-read
spec:
  ports:
  - port: 6379
    name: redis
  selector:
    app: redis
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis
spec:
  serviceName: redis
  replicas: 3
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      initContainers:
      - name: config
        image: redis:7-alpine
        command:
        - sh
        - -c
        - |
          if [ "$(hostname)" = "redis-0" ]; then
            cp /mnt/config/primary.conf /etc/redis/redis.conf
          else
            cp /mnt/config/replica.conf /etc/redis/redis.conf
          fi
        volumeMounts:
        - name: config
          mountPath: /mnt/config
        - name: redis-config-vol
          mountPath: /etc/redis
      containers:
      - name: redis
        image: redis:7-alpine
        command: ["redis-server", "/etc/redis/redis.conf"]
        ports:
        - containerPort: 6379
          name: redis
        volumeMounts:
        - name: redis-data
          mountPath: /data
        - name: redis-config-vol
          mountPath: /etc/redis
      volumes:
      - name: config
        configMap:
          name: redis-config
      - name: redis-config-vol
        emptyDir: {}
  volumeClaimTemplates:
  - metadata:
      name: redis-data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 1Gi
```

Key design decisions:

1. **initContainer checks hostname**: `redis-0` gets the primary config,
   everyone else gets the replica config. This works because StatefulSet Pod
   names are predictable.

2. **Replicas connect to `redis-0.redis`**: the headless Service DNS name.
   Even if `redis-0` restarts on a different node, the DNS name still works.

3. **Two Services**: `redis` (headless) for StatefulSet identity, `redis-read`
   (regular) for load-balanced reads across all replicas.

4. **Ordered startup**: `redis-0` (primary) starts first, then replicas connect
   to it. If replicas started first, they'd fail to connect.

```bash
kubectl apply -f redis-cluster.yaml
kubectl wait --for=condition=ready pods -l app=redis --timeout=120s
```

### Verify Replication

```bash
kubectl exec redis-0 -- redis-cli SET test-key "replicated-value"

kubectl exec redis-1 -- redis-cli GET test-key
kubectl exec redis-2 -- redis-cli GET test-key
```

Both replicas should return `"replicated-value"`.

Check replication status:

```bash
kubectl exec redis-0 -- redis-cli INFO replication
```

You'll see `role:master` and `connected_slaves:2`.

### The Two-Service Pattern

For apps using this Redis cluster:

```go
primaryAddr := "redis-0.redis:6379"
readAddr := "redis-read:6379"

primaryClient := redis.NewClient(&redis.Options{Addr: primaryAddr})
readClient := redis.NewClient(&redis.Options{Addr: readAddr})
```

Writes go to the primary via the headless Service (specific Pod). Reads go to
the regular Service (load-balanced across all Pods). This is a standard
read-replica pattern.

In TypeScript:

```typescript
const primaryClient = createClient({ url: "redis://redis-0.redis:6379" });
const readClient = createClient({ url: "redis://redis-read:6379" });
```

---

## Pod Management Policies

By default, StatefulSets create and delete Pods sequentially. You can change
this with `podManagementPolicy`.

### OrderedReady (Default)

Pods are created in order (0, 1, 2) and deleted in reverse (2, 1, 0). Each Pod
must be Running and Ready before the next one starts.

### Parallel

All Pods are created and deleted simultaneously, like a Deployment. Use this
when your workload doesn't need ordered startup — for example, a distributed
cache where all nodes are peers.

```yaml
spec:
  podManagementPolicy: Parallel
  replicas: 3
```

---

## StatefulSet vs. Deployment Decision Guide

Use a **Deployment** when:
- Your app is stateless (web servers, API gateways)
- Any Pod can handle any request
- You don't need stable network identity
- Data lives in external services (managed database, S3)

Use a **StatefulSet** when:
- Your app has persistent state per instance (databases, message queues)
- Instances have different roles (primary/replica)
- You need stable, predictable hostnames
- Each instance needs its own dedicated storage
- Order of startup/shutdown matters

### Common StatefulSet Workloads

| Workload | Why StatefulSet? |
|----------|-----------------|
| PostgreSQL/MySQL | Primary/replica topology, data per instance |
| Redis Cluster | Node identity for slot assignment |
| Elasticsearch | Data shards bound to specific nodes |
| Kafka | Broker IDs, partition assignment |
| ZooKeeper | Ensemble member identity, election |
| etcd | Cluster member identity |
| MongoDB | Replica set member identity |

---

## Exercises

### Exercise 1: StatefulSet Basics

1. Create a StatefulSet with 3 Nginx replicas and a headless Service
2. Write a unique file to each Pod's persistent volume
3. Delete all three Pods
4. Verify each Pod reattaches to its correct volume with the correct file
5. Scale to 5, then back to 3 — verify PVCs for Pods 3 and 4 remain

### Exercise 2: Ordered vs Parallel

1. Create a StatefulSet with `podManagementPolicy: OrderedReady` and 3 replicas
2. Watch the creation order
3. Delete it and create the same StatefulSet with `Parallel` policy
4. Watch the creation — all Pods start simultaneously
5. When would you choose each policy?

### Exercise 3: Partitioned Rollout

1. Deploy a StatefulSet with `redis:7-alpine` and 5 replicas
2. Set partition to 4 and update the image to `redis:7.2-alpine`
3. Verify only `redis-4` has the new image
4. Gradually reduce the partition to 0, checking at each step
5. Verify all Pods end up on the new image

### Exercise 4: Build a Mini Database Cluster

1. Deploy a 3-node Redis cluster using the replication setup from this lesson
2. Write 100 keys to the primary
3. Verify all 100 keys are readable from the replicas
4. Kill the primary Pod
5. Observe what happens to the replicas (they'll lose connection temporarily)
6. Once `redis-0` comes back, verify replication resumes
7. Verify data persisted across the restart

---

## What Would Happen If...

**Q: You delete a StatefulSet but not its PVCs?**
A: The Pods are deleted but all PVCs and their bound PersistentVolumes remain.
The data is safe. If you recreate the StatefulSet with the same name, the new
Pods will reattach to the existing PVCs. This is intentional — data safety.

**Q: You try to use a Deployment with volumeClaimTemplates?**
A: It won't work. `volumeClaimTemplates` is a StatefulSet-only field.
Deployments share a single PVC across all replicas or use `emptyDir` (which is
per-Pod but not persistent).

**Q: redis-0 crashes and redis-1 gets promoted to primary?**
A: Kubernetes doesn't handle failover logic — that's the application's job. You
need something like Redis Sentinel or an operator (like the Redis Operator) to
detect the failure and reconfigure replicas. StatefulSets provide the identity
and storage primitives. Failover logic is up to the application or operator.

**Q: You scale a StatefulSet to 0?**
A: All Pods are deleted (in reverse order), but PVCs remain. Scale back up and
everything reattaches. This is useful for "parking" a database — stop all Pods
to save compute, keep the data, restart later.

**Q: A PVC's underlying PersistentVolume fails?**
A: The Pod using that PVC gets stuck in `Pending`. The data is potentially lost
unless the storage system has its own replication. This is why production
databases use storage classes backed by replicated storage (like AWS EBS with
snapshots or Rook-Ceph).

---

## Key Takeaways

1. **StatefulSets are for workloads with identity**: stable names, stable DNS,
   stable storage
2. **Pod names are ordinal**: `app-0`, `app-1`, `app-2` — predictable and
   sequential
3. **Requires a headless Service**: for per-Pod DNS records
4. **volumeClaimTemplates**: automatically creates one PVC per Pod
5. **PVCs survive Pod deletion and scale-down**: data safety by default
6. **Ordered operations**: Pods create in order (0→N), delete in reverse (N→0)
7. **Partitioned updates**: canary rollouts by updating only high-ordinal Pods
8. **StatefulSets provide primitives, not logic**: stable identity and storage
   yes, automatic failover no — use operators for that

---

## Cleanup

```bash
kubectl delete statefulset redis
kubectl delete svc redis redis-read
kubectl delete configmap redis-config
kubectl delete pvc -l app=redis
kubectl delete pod dnsutils
kind delete cluster --name stateful-lab
```

---

Next: [Lesson 14: DaemonSets and Jobs →](./14-daemonsets-jobs.md)
