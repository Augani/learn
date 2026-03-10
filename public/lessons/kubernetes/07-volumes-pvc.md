# Volumes and PersistentVolumeClaims

## The Storage Unit Analogy

When you rent an apartment (run a Pod), it comes with built-in closet space. You can store things there, but if you move out (Pod dies), the closet is emptied and given to the next tenant. That's `emptyDir` — ephemeral storage tied to the Pod's lifetime.

If you need storage that survives moves, you rent a storage unit (PersistentVolumeClaim). You tell the storage company "I need 100 square feet." They find or build a unit for you (PersistentVolume). You put your stuff in it. When you move apartments, you still have the storage unit. When you move into a new apartment, you bring the key and keep accessing your stuff.

The storage company itself is the StorageClass — it defines what kind of units are available (basic self-storage, climate-controlled, high-security).

---

## Volume Types Overview

| Type | Lifetime | Use Case |
|------|----------|----------|
| `emptyDir` | Dies with the Pod | Temp files, shared data between containers |
| `hostPath` | Tied to the node | Access node filesystem (avoid in production) |
| `configMap` | Lives independently | Mount config files |
| `secret` | Lives independently | Mount secret files |
| `persistentVolumeClaim` | Lives independently | Databases, file storage, anything persistent |

---

## emptyDir: Scratch Space

An `emptyDir` volume is created when a Pod is assigned to a node and deleted when the Pod is removed. It starts empty.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: scratch-pod
spec:
  volumes:
    - name: scratch
      emptyDir: {}
  containers:
    - name: writer
      image: busybox:1.36
      command: ["sh", "-c", "echo 'hello' > /data/test.txt && sleep 3600"]
      volumeMounts:
        - name: scratch
          mountPath: /data
    - name: reader
      image: busybox:1.36
      command: ["sh", "-c", "sleep 5 && cat /data/test.txt && sleep 3600"]
      volumeMounts:
        - name: scratch
          mountPath: /data
```

Both containers see the same `/data` directory. The writer creates a file; the reader reads it. This is the sidecar pattern's backbone.

### emptyDir backed by memory

For high-speed temp storage:

```yaml
volumes:
  - name: cache
    emptyDir:
      medium: Memory
      sizeLimit: 256Mi
```

This uses RAM-backed tmpfs. Fast, but counts against the container's memory limit. If the Pod dies, it's gone.

Use cases for emptyDir:
- Temporary build artifacts
- Cache that can be regenerated
- Shared data between sidecar containers
- Sort/merge scratch space for batch processing

---

## hostPath: Node Filesystem Access

Maps a path on the node's filesystem into the Pod. Like accessing the building's maintenance room from your apartment.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: hostpath-pod
spec:
  volumes:
    - name: node-logs
      hostPath:
        path: /var/log
        type: Directory
  containers:
    - name: log-reader
      image: busybox:1.36
      command: ["sh", "-c", "ls /host-logs && sleep 3600"]
      volumeMounts:
        - name: node-logs
          mountPath: /host-logs
          readOnly: true
```

**Avoid hostPath in production.** Problems:
- Pods are tied to a specific node (data isn't on other nodes)
- Security risk (Pod can read/write node files)
- Data doesn't migrate when Pods move to another node
- Different nodes might have different data at the same path

Valid uses: DaemonSets that need node-level access (log collectors, monitoring agents).

---

## PersistentVolumes and PersistentVolumeClaims

This is the storage model that matters for production. It decouples storage from Pods.

Three concepts:

**PersistentVolume (PV)**: A piece of storage in the cluster. Created by an admin or dynamically by a StorageClass. Like the actual physical storage unit.

**PersistentVolumeClaim (PVC)**: A request for storage by a user. "I need 10Gi of fast storage." Like a rental agreement.

**StorageClass**: Defines what kind of storage is available and how to provision it. Like the storage company catalog — "we offer standard units, climate-controlled units, and fireproof vaults."

```
User creates PVC ("I need 10Gi")
        ↓
StorageClass provisions PV (creates actual storage)
        ↓
PVC binds to PV (claim fulfilled)
        ↓
Pod mounts PVC (uses the storage)
```

### The Full Flow

**Step 1: StorageClass exists** (usually pre-configured in managed clusters)

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: standard
provisioner: rancher.io/local-path
reclaimPolicy: Delete
volumeBindingMode: WaitForFirstConsumer
```

- `provisioner`: Which plugin creates the storage (varies by cloud/environment)
- `reclaimPolicy`: What happens when the PVC is deleted. `Delete` removes the PV too. `Retain` keeps it.
- `volumeBindingMode`: `WaitForFirstConsumer` creates storage only when a Pod actually needs it

**Step 2: User creates a PVC**

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-data
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: standard
  resources:
    requests:
      storage: 10Gi
```

**Step 3: StorageClass provisions a PV** (happens automatically)

```bash
kubectl get pv
```

```
NAME                                       CAPACITY   ACCESS MODES   STATUS   CLAIM
pvc-a1b2c3d4-e5f6-7890-abcd-ef1234567890  10Gi       RWO            Bound    default/postgres-data
```

**Step 4: Pod uses the PVC**

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: postgres
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

---

## Access Modes

| Mode | Short | Meaning |
|------|-------|---------|
| ReadWriteOnce | RWO | One node can mount read-write |
| ReadOnlyMany | ROX | Many nodes can mount read-only |
| ReadWriteMany | RWX | Many nodes can mount read-write |
| ReadWriteOncePod | RWOP | Only one Pod can mount read-write (K8s 1.27+) |

**RWO is the most common.** Cloud block storage (EBS, GCE PD, Azure Disk) only supports RWO. The disk attaches to one node at a time.

**RWX requires network storage** (NFS, EFS, CephFS, Azure Files). More expensive, slower, but multiple Pods on multiple nodes can write simultaneously.

For a Go API with PostgreSQL: RWO is correct. Only one PostgreSQL instance writes to the data directory.

For a shared file upload directory that multiple API replicas access: you need RWX. Or better — use object storage (S3) instead of filesystem.

---

## Dynamic vs. Static Provisioning

### Dynamic Provisioning (recommended)

You create a PVC. The StorageClass automatically creates a PV. This is what you use 99% of the time.

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: app-data
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: standard
  resources:
    requests:
      storage: 5Gi
```

The provisioner creates the underlying storage (EBS volume, GCE disk, etc.) automatically.

### Static Provisioning

An admin pre-creates PVs. PVCs bind to existing PVs that match their requirements.

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: manual-pv
spec:
  capacity:
    storage: 10Gi
  accessModes:
    - ReadWriteOnce
  storageClassName: manual
  hostPath:
    path: /mnt/data
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: manual-pvc
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: manual
  resources:
    requests:
      storage: 10Gi
```

Use static provisioning when: you have existing storage (NFS shares, pre-provisioned disks), or you're in an environment without a dynamic provisioner.

---

## Reclaim Policies

When a PVC is deleted, what happens to the PV?

| Policy | Behavior |
|--------|----------|
| `Delete` | PV and underlying storage are deleted. Data is gone. |
| `Retain` | PV is kept but marked "Released." Admin must manually clean up. |

**Delete** is the default for dynamic provisioning. Good for ephemeral environments (dev, CI).

**Retain** is essential for production databases. If someone accidentally deletes a PVC, the data survives. The admin can create a new PVC pointing to the retained PV.

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: retain-storage
provisioner: rancher.io/local-path
reclaimPolicy: Retain
```

---

## Hands-On: PostgreSQL with Persistent Storage

This is the most common real-world scenario. Your Go or TypeScript API needs a database that survives Pod restarts.

### Setup

```bash
kind create cluster --name storage-lab
```

### Create the PVC

Save as `postgres-pvc.yaml`:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-data
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
```

```bash
kubectl apply -f postgres-pvc.yaml

kubectl get pvc
```

Status should be `Pending` (waiting for a Pod to claim it, because kind uses `WaitForFirstConsumer`).

### Deploy PostgreSQL

Save as `postgres-deploy.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
spec:
  replicas: 1
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
          env:
            - name: POSTGRES_DB
              value: myapp
            - name: POSTGRES_USER
              value: appuser
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgres-secret
                  key: password
            - name: PGDATA
              value: /var/lib/postgresql/data/pgdata
          volumeMounts:
            - name: data
              mountPath: /var/lib/postgresql/data
          resources:
            requests:
              cpu: 250m
              memory: 256Mi
            limits:
              cpu: 1000m
              memory: 512Mi
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: postgres-data
---
apiVersion: v1
kind: Service
metadata:
  name: postgres-svc
spec:
  selector:
    app: postgres
  ports:
    - port: 5432
      targetPort: 5432
```

```bash
kubectl create secret generic postgres-secret --from-literal=password=mysecretpassword

kubectl apply -f postgres-deploy.yaml

kubectl get pods -w
```

Wait for the Pod to be Running.

### Insert data

```bash
kubectl exec -it deployment/postgres -- psql -U appuser -d myapp -c "CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(100));"

kubectl exec -it deployment/postgres -- psql -U appuser -d myapp -c "INSERT INTO users (name) VALUES ('Alice'), ('Bob'), ('Charlie');"

kubectl exec -it deployment/postgres -- psql -U appuser -d myapp -c "SELECT * FROM users;"
```

### Kill the Pod and verify data persists

```bash
kubectl delete pod -l app=postgres

kubectl get pods -w
```

Wait for the replacement Pod to be Running:

```bash
kubectl exec -it deployment/postgres -- psql -U appuser -d myapp -c "SELECT * FROM users;"
```

The data survives because it's on the PVC, not inside the container.

### Verify PVC binding

```bash
kubectl get pvc

kubectl get pv

kubectl describe pvc postgres-data
```

You'll see the PVC is `Bound` to a PV, with the requested capacity and access mode.

---

## Hands-On: emptyDir for Shared Data

Save as `shared-volume-pod.yaml`:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: shared-vol
spec:
  volumes:
    - name: shared
      emptyDir: {}
  containers:
    - name: producer
      image: busybox:1.36
      command:
        - sh
        - -c
        - |
          counter=0
          while true; do
            counter=$((counter + 1))
            echo "{\"count\": $counter, \"time\": \"$(date)\"}" >> /shared/data.jsonl
            sleep 2
          done
      volumeMounts:
        - name: shared
          mountPath: /shared

    - name: consumer
      image: busybox:1.36
      command:
        - sh
        - -c
        - tail -f /shared/data.jsonl
      volumeMounts:
        - name: shared
          mountPath: /shared
```

```bash
kubectl apply -f shared-volume-pod.yaml

kubectl logs shared-vol -c consumer -f
```

The producer writes JSON lines; the consumer reads them in real-time via the shared volume. This is a common pattern for log processing sidecars.

```bash
kubectl exec shared-vol -c producer -- wc -l /shared/data.jsonl
```

---

## Hands-On: Volume Expansion

Most StorageClasses support volume expansion. You can grow a PVC without downtime.

```bash
kubectl get storageclass

kubectl get storageclass standard -o yaml | grep allowVolumeExpansion
```

If `allowVolumeExpansion: true`:

```bash
kubectl patch pvc postgres-data -p '{"spec":{"resources":{"requests":{"storage":"2Gi"}}}}'

kubectl get pvc postgres-data
```

The PVC expands. For filesystem-based volumes, the resize happens automatically when the Pod restarts (or immediately for some provisioners).

You can only expand PVCs — never shrink them.

---

## Storage in Different Environments

### kind (local development)

kind uses the `rancher.io/local-path` provisioner. Storage is just a directory on the node (Docker container). Good enough for development.

### AWS (EKS)

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast
provisioner: ebs.csi.aws.com
parameters:
  type: gp3
  iops: "3000"
  throughput: "125"
reclaimPolicy: Retain
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
```

Uses EBS volumes. gp3 is the current best default (good price/performance).

### GCP (GKE)

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast
provisioner: pd.csi.storage.gke.io
parameters:
  type: pd-ssd
reclaimPolicy: Retain
volumeBindingMode: WaitForFirstConsumer
```

### For Go/TypeScript developers

Think of storage choices like database choices:
- `emptyDir` = in-memory cache (fast, lost on restart)
- `hostPath` = SQLite (local to one machine)
- PVC with gp3/pd-ssd = Managed PostgreSQL (persistent, production-ready)
- PVC with RWX = Network file share (slower, shared access)

---

## SubPath: Mounting Into an Existing Directory

By default, mounting a volume to a path replaces everything at that path. `subPath` lets you mount a specific file without clobbering the directory.

```yaml
spec:
  volumes:
    - name: config
      configMap:
        name: app-config
  containers:
    - name: app
      image: my-app:v1
      volumeMounts:
        - name: config
          mountPath: /etc/app/config.yaml
          subPath: config.yaml
```

Without `subPath`, everything in `/etc/app/` would be replaced by the ConfigMap contents. With `subPath`, only `config.yaml` is mounted, and other files in `/etc/app/` remain.

---

## What Would Happen If...

**...you deleted a PVC while a Pod was using it?**

Kubernetes doesn't delete it immediately. The PVC enters `Terminating` state but waits for all Pods using it to be deleted first. This prevents data loss from accidental deletion.

```bash
kubectl delete pvc postgres-data
kubectl get pvc
```

Status: `Terminating`. Delete the Pod, and the PVC deletion completes.

**...two Pods tried to mount the same RWO PVC?**

The second Pod stays in `Pending` state. The scheduler can't place it because the PVC is already attached to a node, and RWO means only one node. If both Pods are on the same node, it works — RWO is "one node," not "one Pod."

**...the node with the PVC died?**

The PV is still on the underlying storage (EBS volume, etc.). When Kubernetes reschedules the Pod to a new node, the storage detaches from the dead node and reattaches to the new one. There's a delay (cloud providers take 1-5 minutes to detach from an unresponsive node).

**...you ran PostgreSQL with replicas: 2 and a single PVC?**

Both Pods try to mount the same RWO volume. On a single node, both could mount it, but PostgreSQL would corrupt data (two instances writing to the same data directory). On different nodes, the second Pod would stay `Pending`.

For database replication, use a StatefulSet with `volumeClaimTemplates` — each replica gets its own PVC.

**...you set reclaimPolicy: Delete and accidentally deleted the PVC?**

The PV and underlying storage are deleted. Data is gone. This is why production databases should use `Retain`.

---

## Storage Anti-Patterns

**Don't store application logs on PVCs.** Use stdout/stderr (which kubelet captures) and a log shipper (Fluent Bit, Fluentd). PVC storage is expensive for logs.

**Don't use RWX when RWO works.** RWX is slower and more expensive. If only one Pod needs write access, use RWO.

**Don't put file uploads on local emptyDir.** If the Pod restarts, uploads are lost. Use S3/GCS/MinIO for file uploads, or a PVC.

**Don't use hostPath in production.** It ties Pods to specific nodes and creates security risks.

**Don't forget to set resource limits on PVCs.** A 1Gi PVC that fills up crashes your database. Monitor disk usage.

---

## Exercises

1. **Survive a Pod deletion.** Deploy Redis with a PVC. Write data with `redis-cli SET greeting hello`. Delete the Pod. Wait for the replacement. Read the data back. Verify it persists.

2. **Test access modes.** Create a PVC with ReadWriteOnce. Deploy two Pods that try to mount it, scheduled on different nodes (use a multi-node kind cluster). Observe one staying Pending.

3. **Dynamic provisioning.** Create a PVC without specifying `storageClassName`. See which StorageClass is used by default. Check with `kubectl get storageclass` — one will have `(default)` annotation.

4. **Monitor disk usage.** Deploy PostgreSQL with a 1Gi PVC. Write enough data to approach the limit. Use `kubectl exec` to run `df -h` inside the container to check usage.

5. **Volume expansion.** Create a 1Gi PVC. Verify it's bound. Expand it to 2Gi. Verify the expansion took effect inside the Pod (run `df -h`).

---

## Key Takeaways

- emptyDir is scratch space that dies with the Pod
- PVCs request persistent storage that survives Pod restarts and rescheduling
- StorageClasses enable dynamic provisioning — you request, the system provisions
- RWO (ReadWriteOnce) is the default and most common access mode
- Use `Retain` reclaim policy for production data
- PostgreSQL, Redis, and other databases need PVCs for data durability
- Volume mounts replace directory contents — use `subPath` to mount individual files
- Don't use hostPath in production; don't store logs on PVCs

Next: Namespaces — organizing your cluster into logical partitions.
