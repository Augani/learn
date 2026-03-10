# Kubernetes Architecture

## The Hospital Analogy

Think of Kubernetes as running a large hospital. Not a small clinic — a full hospital with hundreds of patients, dozens of departments, and staff working around the clock.

The hospital has two areas:

**Administration (Control Plane)** — the offices, records room, and management staff who coordinate everything but never directly treat patients.

**Patient Floors (Worker Nodes)** — where the actual work happens. Nurses (kubelet) on each floor carry out orders, check on patients, and report back.

Let's meet each role.

---

## The Control Plane

The control plane runs on dedicated nodes (usually 3 for high availability in production). It makes all the decisions but runs none of your actual application containers.

### API Server — The Front Desk

The API server is the hospital's front desk. Every single interaction goes through it:

- Doctor wants to admit a patient? Goes through the front desk.
- Nurse needs patient records? Asks the front desk.
- Insurance company needs status? Calls the front desk.
- Visitor wants to see a patient? Checks in at the front desk.

Nothing happens in the hospital without going through the front desk first.

In Kubernetes:
- `kubectl` commands hit the API server
- The scheduler talks to the API server
- kubelets on worker nodes report to the API server
- The controller manager watches the API server
- Everything is a REST API call

```
kubectl apply -f deployment.yaml
    ↓
HTTPS POST to API server
    ↓
API server validates the request
    ↓
API server stores it in etcd
    ↓
API server notifies watchers (scheduler, controllers)
```

The API server is the only component that talks directly to etcd. Everything else talks to the API server. This is intentional — one point of access, one place to enforce authentication, authorization, and validation.

For Go/TypeScript engineers: the API server is like an Express or Gin HTTP server with middleware for auth, validation, and persistence. Every Kubernetes resource (Pods, Services, Deployments) is a REST endpoint.

```
GET    /api/v1/namespaces/default/pods          → list pods
GET    /api/v1/namespaces/default/pods/my-pod    → get one pod
POST   /api/v1/namespaces/default/pods           → create a pod
PUT    /api/v1/namespaces/default/pods/my-pod    → update a pod
DELETE /api/v1/namespaces/default/pods/my-pod    → delete a pod
WATCH  /api/v1/namespaces/default/pods?watch=true → stream changes
```

You can actually call these directly:

```bash
kubectl get --raw /api/v1/namespaces/default/pods | jq '.items[].metadata.name'
```

### etcd — The Filing Cabinet

etcd is the hospital's medical records system. Every patient's chart, every doctor's schedule, every room assignment — all stored here. If the records room burns down, the hospital can't function.

etcd is a distributed key-value store. It holds the entire state of the Kubernetes cluster:

- Every Pod definition
- Every Service configuration
- Every Secret
- Every node's registration
- Current state of every resource

Properties of etcd:
- **Strongly consistent** — every read returns the most recent write. No stale data.
- **Distributed** — runs across multiple nodes for fault tolerance (typically 3 or 5 instances using Raft consensus).
- **Watch-based** — components can subscribe to changes. "Tell me when any Pod in namespace X changes."

Only the API server reads from or writes to etcd. This keeps things simple and secure.

Data in etcd looks like:

```
/registry/pods/default/my-pod → { full Pod JSON }
/registry/deployments/default/my-app → { full Deployment JSON }
/registry/services/default/my-svc → { full Service JSON }
```

For Go engineers: etcd is like a distributed `sync.Map` with built-in change notifications (watchers). The Raft consensus protocol ensures all replicas agree on the same state.

**What happens if etcd dies?** The cluster keeps running (existing Pods stay up), but you can't make any changes. No new deployments, no scaling, no config changes. This is why etcd backup is critical in production.

### Scheduler — The Bed Assignment Manager

When a new patient arrives (a Pod needs to be created), someone has to decide which floor and which room they go to. That's the scheduler.

The scheduler watches for Pods that have been created but not assigned to a node (the Pod's `spec.nodeName` is empty). When it finds one, it:

1. **Filters** — eliminates nodes that can't run the Pod (not enough CPU, not enough memory, wrong architecture, taints that don't match tolerations)
2. **Scores** — ranks the remaining nodes (which has the most available resources, which would spread the workload most evenly, which already has the container image cached)
3. **Binds** — assigns the Pod to the highest-scoring node by setting `spec.nodeName`

```
New Pod created (no nodeName)
    ↓
Scheduler notices via API server watch
    ↓
Filter: Node A (2GB free) ✗ — Pod needs 4GB
        Node B (8GB free) ✓
        Node C (6GB free) ✓
    ↓
Score:  Node B: 85 (most resources)
        Node C: 72 (decent resources)
    ↓
Bind:   Pod → Node B
```

The scheduler makes the decision, then writes the result back to the API server. It doesn't actually start the Pod — that's the kubelet's job.

Think of it like a hospital that assigns rooms based on:
- Does the room have the right equipment? (resource requirements)
- Is the room available? (capacity)
- Is the patient in isolation? (taints and tolerations)
- Should we spread ICU patients across floors? (anti-affinity rules)

### Controller Manager — The Compliance Department

The controller manager runs a collection of control loops, each responsible for one type of resource. Think of them as compliance officers who constantly audit the hospital:

- **Replication Controller**: "Dr. Smith ordered 3 nurses on Floor 2. I count 2. Hire one more."
- **Node Controller**: "Floor 5 hasn't reported in for 5 minutes. Mark it as offline. Move patients."
- **Endpoint Controller**: "The directory says Service A points to Pods X, Y, Z. But Pod Z was deleted. Update the directory."
- **ServiceAccount Controller**: "New namespace created. Create the default service account."

Each controller follows the same pattern:

```
desired_state = read from API server
current_state = observe from API server
if current_state != desired_state:
    take corrective action via API server
```

The Deployment controller is the one you'll interact with most:

1. You create a Deployment (desired: 3 replicas of my-app:v1)
2. Deployment controller creates a ReplicaSet
3. ReplicaSet controller sees it needs 3 Pods, creates them
4. Scheduler assigns them to nodes
5. Kubelets on those nodes start the containers

If you delete a Pod, the ReplicaSet controller notices (current=2, desired=3) and creates a replacement. If you update the Deployment's image to v2, the Deployment controller creates a new ReplicaSet, scales it up, and scales the old one down.

For TypeScript/Go engineers: controllers are like event-driven workers watching a message queue. Each watches for specific events (Pod created, Pod deleted, Node offline) and takes action. They're idempotent — running the same reconciliation twice produces the same result.

### Cloud Controller Manager

If you're on AWS, GCP, or Azure, there's an extra component: the cloud controller manager. It bridges Kubernetes abstractions to cloud-specific APIs:

- `Service type: LoadBalancer` → creates an AWS ELB
- `PersistentVolumeClaim` → creates an EBS volume
- Node disappears → checks with EC2 if the instance still exists

You won't interact with this directly, but it's why `kubectl create service --type=LoadBalancer` magically provisions a real load balancer in your cloud account.

---

## Worker Nodes

Worker nodes are where your containers actually run. Each worker node runs three components.

### kubelet — The Floor Nurse

Every hospital floor has a head nurse who:
- Receives orders from administration ("Admit patient to Room 302")
- Carries them out
- Monitors patients continuously
- Reports status back to admin
- Calls a code if something goes wrong

The kubelet is that nurse. It runs on every worker node and:

1. **Watches the API server** for Pods assigned to its node
2. **Tells the container runtime** to start/stop containers
3. **Runs health checks** (liveness probes, readiness probes)
4. **Reports status** back to the API server (Pod running, Pod failed, node resources)

```
API server assigns Pod to Node B
    ↓
kubelet on Node B picks it up
    ↓
kubelet tells container runtime: "Pull image my-app:v1, start container"
    ↓
Container starts
    ↓
kubelet runs liveness probe every 10 seconds
    ↓
kubelet reports Pod status = Running to API server
```

The kubelet also handles:
- Volume mounting (attaching storage to containers)
- Config injection (ConfigMaps and Secrets as files or env vars)
- Resource enforcement (killing containers that exceed memory limits)
- Container restart (respecting the Pod's restart policy)

**What if the kubelet crashes?** Containers already running on that node keep running (the container runtime manages them). But no new Pods get scheduled, no health checks run, and the node eventually gets marked `NotReady`.

### kube-proxy — The Mail Room

Every hospital has a mail room that routes internal mail. You don't send mail to "Nurse Johnson in Room 302" — you send it to "Cardiology Department" and the mail room figures out who's there today.

kube-proxy handles network routing on each node. When a Pod tries to reach a Service (like `my-database:5432`), kube-proxy routes that traffic to one of the Pods behind the Service.

kube-proxy works in one of three modes:

**iptables mode** (default): Programs Linux iptables rules on the node. Every Service gets a set of rules that DNAT (destination NAT) traffic to actual Pod IPs.

```
Traffic to ClusterIP 10.96.0.100:80
    ↓
iptables rule: DNAT to one of:
    Pod 10.244.1.5:8080 (33%)
    Pod 10.244.2.3:8080 (33%)
    Pod 10.244.1.8:8080 (34%)
```

**IPVS mode**: Uses Linux IPVS (IP Virtual Server) for more efficient load balancing at scale. Better for clusters with thousands of Services.

**nftables mode** (newer): Uses nftables instead of iptables. More efficient rule processing.

For Go/TypeScript engineers: kube-proxy is like a reverse proxy (think nginx), but implemented at the kernel level using iptables rules. It's not a userspace proxy sitting in the traffic path — it programs the kernel's network stack to do the routing.

### Container Runtime — The Medical Equipment

The container runtime is the actual technology that runs containers. kubelet tells it what to do; it does the work.

Common container runtimes:
- **containerd** — the default in most Kubernetes distributions. Docker itself uses containerd under the hood.
- **CRI-O** — designed specifically for Kubernetes. Lighter weight.

Kubernetes talks to the container runtime through the **CRI (Container Runtime Interface)** — a standardized API. This is why Kubernetes dropped direct Docker support in v1.24 — it only needs the CRI, and containerd implements it directly.

```
kubelet → CRI API → containerd → actually runs the container
```

---

## How They All Communicate

Here's the communication map. Every arrow goes through the API server:

```
                    ┌──────────────────────────────┐
                    │         Control Plane         │
                    │                               │
                    │  ┌─────────────────────────┐  │
       kubectl ───────→│      API Server         │  │
                    │  └──┬──────┬──────┬────────┘  │
                    │     │      │      │            │
                    │     ▼      │      ▼            │
                    │  ┌──────┐  │  ┌──────────────┐│
                    │  │ etcd │  │  │  Controller   ││
                    │  └──────┘  │  │  Manager      ││
                    │            │  └──────────────┘│
                    │            ▼                   │
                    │     ┌──────────────┐           │
                    │     │  Scheduler   │           │
                    │     └──────────────┘           │
                    └──────────────────────────────┘
                                │
                    ┌───────────┼───────────┐
                    │           │           │
                    ▼           ▼           ▼
              ┌──────────┐┌──────────┐┌──────────┐
              │  Node A  ││  Node B  ││  Node C  │
              │          ││          ││          │
              │ kubelet  ││ kubelet  ││ kubelet  │
              │ kube-    ││ kube-    ││ kube-    │
              │ proxy    ││ proxy    ││ proxy    │
              │ runtime  ││ runtime  ││ runtime  │
              │          ││          ││          │
              │ [Pod]    ││ [Pod]    ││ [Pod]    │
              │ [Pod]    ││ [Pod]    ││ [Pod]    │
              └──────────┘└──────────┘└──────────┘
```

Key communication patterns:
- **kubectl → API server**: HTTPS REST calls (the only way humans interact)
- **API server → etcd**: gRPC (only the API server talks to etcd)
- **Scheduler → API server**: Watch for unscheduled Pods, write binding decisions
- **Controller Manager → API server**: Watch for state changes, write corrections
- **kubelet → API server**: Report node/Pod status, watch for Pod assignments
- **kube-proxy → API server**: Watch for Service/Endpoint changes, update iptables rules

Everything uses the **watch** mechanism: components open a long-lived connection to the API server and receive streaming updates when resources change. This is far more efficient than polling.

---

## What Happens When You Run `kubectl apply`

Let's trace a complete deployment from `kubectl apply` to containers running on nodes. This is the sequence you need to understand.

You have this file (`deployment.yaml`):

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web-api
  template:
    metadata:
      labels:
        app: web-api
    spec:
      containers:
        - name: api
          image: my-api:v1
          ports:
            - containerPort: 8080
          resources:
            requests:
              cpu: 200m
              memory: 256Mi
```

```bash
kubectl apply -f deployment.yaml
```

**Step 1: kubectl → API Server**

kubectl reads the YAML, validates the structure client-side, and sends an HTTPS POST to the API server.

```
POST /apis/apps/v1/namespaces/default/deployments
Body: { the deployment JSON }
```

**Step 2: API Server validates and stores**

The API server:
- Authenticates the request (who are you?)
- Authorizes the request (can you create Deployments in this namespace?)
- Validates the manifest (are required fields present? are values valid?)
- Runs admission controllers (mutating webhooks, validating webhooks)
- Stores the Deployment object in etcd
- Returns success to kubectl

**Step 3: Deployment controller creates a ReplicaSet**

The Deployment controller (running inside the controller manager) is watching the API server. It sees a new Deployment. It creates a ReplicaSet:

```
ReplicaSet: web-api-7d9f8b6c4a
  replicas: 3
  selector: app=web-api
  template: (same as the Deployment's template)
```

**Step 4: ReplicaSet controller creates Pods**

The ReplicaSet controller sees a new ReplicaSet with desired=3 and current=0. It creates 3 Pod objects via the API server:

```
Pod: web-api-7d9f8b6c4a-x2k9p (no nodeName yet)
Pod: web-api-7d9f8b6c4a-m4h7j (no nodeName yet)
Pod: web-api-7d9f8b6c4a-q9n3r (no nodeName yet)
```

**Step 5: Scheduler assigns Pods to nodes**

The scheduler watches for Pods with no `nodeName`. For each Pod:
- Filter: which nodes have 200m CPU and 256Mi memory available?
- Score: which of those nodes is the best fit?
- Bind: write `spec.nodeName = node-2` to the Pod via the API server

```
Pod x2k9p → Node A
Pod m4h7j → Node B
Pod q9n3r → Node A
```

**Step 6: kubelet starts containers**

The kubelet on Node A watches the API server for Pods assigned to it. It sees two new Pods. For each:
- Pulls the `my-api:v1` image (if not cached)
- Creates the container sandbox (network namespace, etc.)
- Starts the container
- Begins running health probes
- Reports status back to the API server: Pod phase = Running

**Step 7: You see the result**

```bash
kubectl get pods -o wide
```

```
NAME                       READY   STATUS    NODE
web-api-7d9f8b6c4a-x2k9p  1/1     Running   node-a
web-api-7d9f8b6c4a-m4h7j  1/1     Running   node-b
web-api-7d9f8b6c4a-q9n3r  1/1     Running   node-a
```

The whole process takes seconds. But behind the scenes, six different components coordinated through the API server.

---

## High Availability

In production, you don't want a single point of failure in the control plane.

**etcd**: Run 3 or 5 instances with Raft consensus. Can tolerate 1 or 2 failures respectively.

**API Server**: Run multiple instances behind a load balancer. All are active (not leader-based). Any request can go to any instance.

**Scheduler and Controller Manager**: Run multiple instances, but only one is active at a time (leader election). If the leader dies, another takes over in seconds.

```
                Load Balancer
              /      |      \
        API-1    API-2    API-3
              \      |      /
        etcd-1   etcd-2   etcd-3

        Scheduler-1 (leader)  Scheduler-2 (standby)
        Controller-1 (leader) Controller-2 (standby)
```

Managed Kubernetes services (EKS, GKE, AKS) handle all this for you. The control plane is their problem. You only manage worker nodes.

---

## Hands-On: Explore the Architecture

### Set up a kind cluster

```bash
kind create cluster --name arch-lab
```

### See the control plane components

```bash
kubectl get pods -n kube-system
```

You'll see Pods for:
- `etcd-arch-lab-control-plane`
- `kube-apiserver-arch-lab-control-plane`
- `kube-scheduler-arch-lab-control-plane`
- `kube-controller-manager-arch-lab-control-plane`
- `kube-proxy-*` (one per node)
- `coredns-*` (DNS for the cluster)
- `kindnet-*` (kind's CNI plugin)

### Talk to the API server directly

```bash
kubectl get --raw /api/v1/namespaces | jq '.items[].metadata.name'

kubectl get --raw /apis | jq '.groups[].name'

kubectl get --raw /healthz

kubectl get --raw /metrics | head -20
```

### Watch the reconciliation loop in action

Terminal 1 — watch Pods:
```bash
kubectl get pods -w
```

Terminal 2 — create and break things:
```bash
kubectl create deployment test --image=nginx --replicas=3

sleep 10

kubectl delete pod $(kubectl get pods -l app=test -o name | head -1)
```

In Terminal 1, watch the deleted Pod get replaced automatically.

### See what the scheduler decided

```bash
kubectl create deployment sched-test --image=nginx --replicas=5
kubectl get pods -o wide
```

Look at the NODE column. The scheduler spread the Pods across available nodes.

```bash
kubectl describe pod <any-pod-name> | grep -A5 Events
```

Events show the scheduling decision and container start.

### Inspect etcd (advanced)

In kind, you can exec into the control plane container:

```bash
docker exec -it arch-lab-control-plane crictl ps | grep etcd
```

etcd data is stored at `/var/lib/etcd` inside the control plane container.

### Check component health

```bash
kubectl get componentstatuses

kubectl get --raw /healthz/etcd

kubectl get --raw /healthz/poststarthook/start-kube-apiserver-admission-initializer
```

---

## What Would Happen If...

**...the API server went down?**

Everything already running keeps running. kubelet continues managing containers on each node. kube-proxy keeps routing traffic. But: no new deployments, no scaling, no kubectl commands, no self-healing (because controllers can't talk to the API server to create replacement Pods). Think of it as the hospital front desk closing — patients in beds are fine, but no new admissions.

**...etcd lost data?**

Catastrophic. The cluster "forgets" what it's supposed to be running. Existing containers keep running (kubelet manages them locally), but the control plane has no record of them. This is why etcd backups are critical.

```bash
etcdctl snapshot save /backup/etcd-$(date +%Y%m%d).db
```

**...the scheduler crashed?**

Existing Pods keep running. New Pods get created but stay in `Pending` state (no `nodeName` assigned). As soon as the scheduler restarts, it processes the backlog. No data loss — all Pods are stored in etcd.

**...a kubelet crashed on a worker node?**

Containers on that node keep running (the container runtime manages them). But no health checks, no status reports, no new Pods. After 5 minutes, the node is marked `NotReady` and Pods get rescheduled to other nodes.

**...you have a network partition between control plane and workers?**

Workers keep running their existing Pods. The control plane thinks the workers are dead (no heartbeats). After the timeout, it marks nodes as `NotReady` and tries to reschedule Pods — but those Pods are actually still running on the partitioned nodes. When the network heals, there could briefly be duplicate Pods. Kubernetes handles this through lease-based ownership.

---

## Control Plane vs. Data Plane

This distinction comes from networking but applies to Kubernetes:

**Control Plane**: Makes decisions. Where to place Pods, how many to run, what network rules to apply. Slow-changing, consistency matters.

**Data Plane**: Does the work. Running containers, routing packets, serving requests. Fast-path, performance matters.

| Control Plane | Data Plane |
|--------------|------------|
| API Server | kubelet |
| etcd | container runtime |
| Scheduler | kube-proxy |
| Controller Manager | your Pods |

In Go terms: the control plane is like the `main()` goroutine that sets up and manages worker goroutines (the data plane). The workers do the actual processing; the main goroutine coordinates them.

---

## How This Maps to Managed Kubernetes

When you use EKS, GKE, or AKS:

| Component | Who Manages It |
|-----------|---------------|
| API Server | Cloud provider |
| etcd | Cloud provider |
| Scheduler | Cloud provider |
| Controller Manager | Cloud provider |
| Worker Nodes | You (but can use auto-scaling node groups) |
| kubelet | You (installed on your nodes) |
| kube-proxy | You (but usually auto-configured) |
| CNI Plugin | You choose and install |

The cloud provider gives you an API server endpoint. You point kubectl at it. You never see etcd, never manage the scheduler. You just manage worker nodes and deploy your apps.

This is why managed Kubernetes is the standard for production — you get the orchestration benefits without managing the orchestrator.

---

## Exercises

1. **Map the components to your mental model.** Draw a diagram (on paper) of the control plane and worker nodes. For each component, write one sentence about what it does without looking at this lesson.

2. **Trace a deletion.** Run `kubectl delete deployment test` and describe what happens at each level: API server, controller manager, scheduler (does it get involved?), kubelet. Check with `kubectl get events --sort-by=.lastTimestamp`.

3. **Break the control plane.** In your kind cluster, try pausing the API server container and see what happens to running Pods. (Spoiler: they keep running.)

```bash
docker pause arch-lab-control-plane
kubectl get pods
docker unpause arch-lab-control-plane
```

4. **Find the kubelet.** Since kind runs nodes as Docker containers, you can exec into a "node" and see the kubelet process:

```bash
docker exec -it arch-lab-control-plane ps aux | grep kubelet
```

5. **Explore the API.** Use `kubectl api-resources` to see every resource type the API server knows about. Count them. Pick three you don't recognize and look them up.

---

## Key Takeaways

- The control plane (API server, etcd, scheduler, controller manager) makes decisions
- Worker nodes (kubelet, kube-proxy, container runtime) do the work
- Everything goes through the API server — it's the single source of truth
- etcd stores all cluster state — back it up
- Controllers run reconciliation loops: observe → compare → act
- The scheduler decides placement; kubelet executes it
- Components communicate through watches on the API server, not direct connections
- Managed Kubernetes (EKS/GKE/AKS) manages the control plane for you

Next: the smallest unit Kubernetes runs — Pods.
