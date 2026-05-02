# Lesson 20: Debugging Kubernetes — Being the Detective

## The Big Picture

Debugging Kubernetes is like being a detective. You arrive at a crime scene
(a broken deployment) and you have tools:

- **`kubectl describe`** gives you the **crime scene report** — what happened
  to the resource, what events occurred, what conditions were met or failed.

- **`kubectl logs`** gives you **witness statements** — what the application
  itself said before, during, and after the incident.

- **`kubectl exec`** lets you **visit the crime scene** — get inside the
  container and look around with your own eyes.

- **`kubectl get events`** gives you **security camera footage** — a
  chronological record of everything the cluster did.

- **`kubectl debug`** gives you **forensic tools** — attach a specialized
  debug container when the original container is too minimal (no shell, no
  tools).

A good detective doesn't use just one tool. They triangulate — cross-reference
evidence from multiple sources to find the root cause.

---

## Prerequisites

- Lesson 03 (Pods)
- Lesson 04 (Deployments)
- Lesson 05 (Services)
- Lesson 11 (DNS)

```bash
kind create cluster --name debug-lab
```

---

## The Debugging Toolkit

### Tool 1: kubectl get — The Quick Glance

Start broad. Get an overview of what's running and what's not:

```bash
kubectl get pods
kubectl get pods -o wide
kubectl get all
kubectl get pods --all-namespaces
```

The STATUS column tells you a lot:

| Status | Meaning |
|--------|---------|
| Running | Pod is running normally |
| Pending | Pod can't be scheduled (resource issue, node issue) |
| ContainerCreating | Image is being pulled or volumes being mounted |
| CrashLoopBackOff | Container keeps crashing and Kubernetes is backing off restarts |
| ImagePullBackOff | Can't pull the container image |
| ErrImagePull | Image pull failed (first attempt) |
| Completed | Container finished successfully (Jobs) |
| Terminating | Pod is shutting down |
| OOMKilled | Container exceeded memory limit |
| Error | Container exited with non-zero code |
| Init:Error | An init container failed |
| Init:CrashLoopBackOff | An init container keeps crashing |

### Tool 2: kubectl describe — The Full Report

```bash
kubectl describe pod <pod-name>
```

This is your most valuable debugging command. It shows:

- **Labels and annotations**
- **Node assignment** (or why it wasn't assigned)
- **Container status** (running, waiting, terminated + reasons)
- **Conditions** (scheduled, initialized, ready, containers ready)
- **Events** (chronological log of what happened to this Pod)

The **Events** section at the bottom is gold. Read it bottom-up (oldest first):

```
Events:
  Type     Reason            Age   Message
  ----     ------            ----  -------
  Normal   Scheduled         60s   Successfully assigned to node-1
  Normal   Pulling           58s   Pulling image "myapp:v2"
  Warning  Failed            45s   Failed to pull image "myapp:v2": not found
  Warning  BackOff           30s   Back-off pulling image "myapp:v2"
  Normal   Pulling           15s   Pulling image "myapp:v2"
  Warning  Failed            5s    Failed to pull image "myapp:v2": not found
```

### Tool 3: kubectl logs — What the App Says

```bash
kubectl logs <pod-name>
kubectl logs <pod-name> -c <container-name>
kubectl logs <pod-name> --previous
kubectl logs <pod-name> -f
kubectl logs <pod-name> --since=5m
kubectl logs <pod-name> --tail=50
```

Critical flags:
- **--previous**: shows logs from the last crashed container. Essential for
  CrashLoopBackOff debugging — the current container might be too new to have
  useful logs.
- **-c**: specify which container in a multi-container Pod
- **-f**: follow (stream) logs in real-time

### Tool 4: kubectl exec — Get Inside

```bash
kubectl exec -it <pod-name> -- /bin/sh
kubectl exec -it <pod-name> -c <container> -- /bin/bash
kubectl exec <pod-name> -- cat /etc/resolv.conf
kubectl exec <pod-name> -- env
kubectl exec <pod-name> -- wget -qO- http://other-service:80
```

Once inside, you can:
- Check environment variables
- Test network connectivity
- Inspect files
- Run diagnostic commands
- Verify DNS resolution

### Tool 5: kubectl debug — Forensic Container

Some containers are minimal (distroless, scratch-based) with no shell. You
can't `exec` into them. `kubectl debug` creates an **ephemeral container** in
the same Pod:

```bash
kubectl debug -it <pod-name> --image=busybox --target=<container-name>
```

This adds a busybox container that shares the same process namespace as the
target container. You can see its processes, filesystems, and network.

For node-level debugging:

```bash
kubectl debug node/<node-name> -it --image=busybox
```

### Tool 6: kubectl get events — The Timeline

```bash
kubectl get events --sort-by=.metadata.creationTimestamp
kubectl get events --field-selector type=Warning
kubectl get events --field-selector involvedObject.name=<pod-name>
```

Events give you the cluster's perspective — what the scheduler, kubelet, and
controllers did.

---

## Common Failure Patterns

Let's deploy broken things on purpose and systematically debug them.

### Pattern 1: CrashLoopBackOff

The container starts, crashes, Kubernetes restarts it, it crashes again.
Kubernetes increases the delay between restarts (exponential backoff: 10s, 20s,
40s, 80s, up to 5 minutes).

**Create the broken Pod**:

```yaml
# file: crash-loop.yaml
apiVersion: v1
kind: Pod
metadata:
  name: crash-loop
spec:
  containers:
  - name: broken
    image: busybox
    command: ["sh", "-c", "echo 'Starting...' && exit 1"]
```

```bash
kubectl apply -f crash-loop.yaml
```

**Debug it**:

```bash
kubectl get pod crash-loop
```

```
NAME         READY   STATUS             RESTARTS      AGE
crash-loop   0/1     CrashLoopBackOff   3 (25s ago)   60s
```

```bash
kubectl describe pod crash-loop
```

Look at the Events section:
```
Events:
  Type     Reason     Age               Message
  ----     ------     ----              -------
  Normal   Pulled     60s (x4 over 2m)  Container image already present
  Normal   Created    60s (x4 over 2m)  Created container broken
  Normal   Started    60s (x4 over 2m)  Started container broken
  Warning  BackOff    30s (x6 over 2m)  Back-off restarting failed container
```

```bash
kubectl logs crash-loop --previous
```

```
Starting...
```

The container starts but exits with code 1. Check the `Last State` in describe:

```
    Last State:   Terminated
      Reason:     Error
      Exit Code:  1
```

**Root cause**: the command `exit 1` makes the container fail. In real life,
this could be a misconfigured database connection, a missing environment
variable, or a startup assertion failure.

**Common CrashLoopBackOff causes**:
- Application error on startup (missing config, bad connection string)
- Missing environment variable that the app requires
- Permission denied on a file or directory
- OOMKilled (check exit code 137)
- Liveness probe failure (container starts but health check fails)

### Pattern 2: ImagePullBackOff

Kubernetes can't download the container image.

```yaml
# file: image-pull-fail.yaml
apiVersion: v1
kind: Pod
metadata:
  name: bad-image
spec:
  containers:
  - name: app
    image: myregistry.example.com/nonexistent:v1
```

```bash
kubectl apply -f image-pull-fail.yaml
```

```bash
kubectl get pod bad-image
```

```
NAME        READY   STATUS             RESTARTS   AGE
bad-image   0/1     ImagePullBackOff   0          30s
```

```bash
kubectl describe pod bad-image
```

Events:
```
  Warning  Failed   10s  Failed to pull image "myregistry.example.com/nonexistent:v1":
                          rpc error: code = NotFound desc = failed to pull and unpack image
  Warning  Failed   10s  Error: ErrImagePull
  Normal   BackOff  8s   Back-off pulling image "myregistry.example.com/nonexistent:v1"
  Warning  Failed   8s   Error: ImagePullBackOff
```

**Common ImagePullBackOff causes**:
- Image name typo (`ngnix` instead of `nginx`)
- Tag doesn't exist (`:latest` was deleted, `:v2` doesn't exist yet)
- Private registry without imagePullSecrets configured
- Registry is down or unreachable
- Docker Hub rate limiting (too many pulls from the same IP)

**Fix checklist**:
1. Check image name and tag: `docker pull <image>` from your machine
2. Check imagePullSecrets: `kubectl get pod <name> -o yaml | grep imagePullSecrets`
3. Check registry accessibility from the node
4. For private registries, create a Secret and reference it

### Pattern 3: Pending (Unschedulable)

The Pod can't be placed on any node.

```yaml
# file: pending-pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: too-big
spec:
  containers:
  - name: app
    image: busybox
    command: ["sleep", "infinity"]
    resources:
      requests:
        cpu: "100"
        memory: 100Gi
```

```bash
kubectl apply -f pending-pod.yaml
```

```bash
kubectl get pod too-big
```

```
NAME      READY   STATUS    RESTARTS   AGE
too-big   0/1     Pending   0          30s
```

```bash
kubectl describe pod too-big
```

Events:
```
  Warning  FailedScheduling  10s  0/1 nodes are available:
           1 Insufficient cpu, 1 Insufficient memory.
```

**Common Pending causes**:
- Insufficient resources (requests exceed available capacity)
- Node selector or affinity doesn't match any node
- Taints on all nodes that the Pod doesn't tolerate
- PersistentVolumeClaim can't be bound (no matching PV)
- ResourceQuota exceeded

**Fix checklist**:
1. Check node capacity: `kubectl describe node <name> | grep -A 10 Allocated`
2. Check Pod requests: too high?
3. Check node selectors/affinity: `kubectl get pod <name> -o yaml | grep nodeSelector`
4. Check taints: `kubectl describe nodes | grep Taint`
5. Check PVCs: `kubectl get pvc`
6. Check quotas: `kubectl describe quota`

### Pattern 4: OOMKilled

Container exceeded its memory limit.

```yaml
# file: oom-kill.yaml
apiVersion: v1
kind: Pod
metadata:
  name: memory-hog
spec:
  containers:
  - name: hog
    image: polinux/stress
    command: ["stress"]
    args: ["--vm", "1", "--vm-bytes", "200M", "--vm-hang", "1"]
    resources:
      limits:
        memory: 100Mi
```

```bash
kubectl apply -f oom-kill.yaml
```

```bash
kubectl get pod memory-hog
```

```
NAME         READY   STATUS      RESTARTS     AGE
memory-hog   0/1     OOMKilled   2 (20s ago)  45s
```

```bash
kubectl describe pod memory-hog | grep -A 5 "Last State"
```

```
    Last State:     Terminated
      Reason:       OOMKilled
      Exit Code:    137
```

Exit code 137 = 128 + 9 (SIGKILL). The Linux kernel OOM killer terminated the
process.

**Fix checklist**:
1. Is the memory limit too low? Increase it.
2. Does the app have a memory leak? Profile it.
3. For Go: set `GOMEMLIMIT`. For Node: set `--max-old-space-size`.
4. Check if the app caches too aggressively.

### Pattern 5: Service Not Reachable

The app is running but can't be reached via its Service.

```yaml
# file: broken-service.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web-app
  template:
    metadata:
      labels:
        app: web-app
        version: v1
    spec:
      containers:
      - name: web
        image: hashicorp/http-echo
        args: ["-text=hello"]
        ports:
        - containerPort: 5678
---
apiVersion: v1
kind: Service
metadata:
  name: web-app
spec:
  selector:
    app: web-app-typo
  ports:
  - port: 80
    targetPort: 5678
```

Notice the bug: the Service selector says `web-app-typo` but the Deployment
labels say `web-app`.

```bash
kubectl apply -f broken-service.yaml
kubectl wait --for=condition=ready pods -l app=web-app --timeout=60s
```

The Pods are running fine:

```bash
kubectl get pods -l app=web-app
```

```
NAME                       READY   STATUS    RESTARTS   AGE
web-app-abc123-def45       1/1     Running   0          30s
web-app-abc123-ghi67       1/1     Running   0          30s
```

But the Service doesn't work:

```bash
kubectl run test --image=busybox --rm -it --restart=Never -- wget -qO- --timeout=3 web-app:80
```

Timeout. Why?

**Debug the Service**:

```bash
kubectl get endpoints web-app
```

```
NAME      ENDPOINTS   AGE
web-app   <none>      60s
```

No endpoints. The Service has zero backend Pods. The selector doesn't match.

```bash
kubectl describe svc web-app
```

```
Selector:  app=web-app-typo
```

```bash
kubectl get pods --show-labels
```

```
NAME                       LABELS
web-app-abc123-def45       app=web-app,version=v1
web-app-abc123-ghi67       app=web-app,version=v1
```

Labels say `app=web-app`. Service selects `app=web-app-typo`. Mismatch.

**Service debugging flowchart**:

```
Service not responding?
│
├── Check Pod status → kubectl get pods -l <selector>
│   └── No Pods? → Selector labels don't match
│
├── Check endpoints → kubectl get endpoints <service>
│   └── No endpoints? → Selector doesn't match Pod labels
│
├── Check DNS → kubectl exec <pod> -- nslookup <service>
│   └── NXDOMAIN? → Service name wrong or CoreDNS down
│
├── Check target port → kubectl describe svc <service>
│   └── targetPort wrong? → Container doesn't listen on that port
│
└── Check Pod connectivity → kubectl exec <pod> -- wget -qO- <pod-ip>:<port>
    └── Connection refused? → App not listening, wrong port, or app crashed
```

### Pattern 6: Init Container Failure

```yaml
# file: init-fail.yaml
apiVersion: v1
kind: Pod
metadata:
  name: init-fail
spec:
  initContainers:
  - name: wait-for-db
    image: busybox
    command: ["sh", "-c", "nslookup database-that-doesnt-exist"]
  containers:
  - name: app
    image: busybox
    command: ["sleep", "infinity"]
```

```bash
kubectl apply -f init-fail.yaml
```

```bash
kubectl get pod init-fail
```

```
NAME        READY   STATUS                  RESTARTS   AGE
init-fail   0/1     Init:CrashLoopBackOff   3          60s
```

The `Init:` prefix tells you an init container is failing. The main container
hasn't started yet.

```bash
kubectl logs init-fail -c wait-for-db
```

```
nslookup: can't resolve 'database-that-doesnt-exist'
```

The init container is waiting for a Service that doesn't exist.

---

## Debugging Networking

### DNS Issues

```bash
kubectl run dnsutils --image=tutum/dnsutils --restart=Never --command -- sleep 3600
kubectl wait --for=condition=ready pod/dnsutils --timeout=60s

kubectl exec dnsutils -- nslookup kubernetes.default
kubectl exec dnsutils -- nslookup <your-service>
kubectl exec dnsutils -- cat /etc/resolv.conf
```

If DNS doesn't work:

```bash
kubectl get pods -n kube-system -l k8s-app=kube-dns
kubectl logs -n kube-system -l k8s-app=kube-dns
```

### Pod-to-Pod Connectivity

```bash
kubectl exec <pod-a> -- wget -qO- --timeout=3 <pod-b-ip>:<port>
```

If this fails but DNS works, check:
- Network policies blocking traffic
- Security groups (in cloud environments)
- CNI plugin issues

### Port Forwarding for Quick Testing

```bash
kubectl port-forward pod/<pod-name> 8080:5678
curl localhost:8080
```

This bypasses the Service entirely. If port-forward works but the Service
doesn't, the issue is with the Service configuration (selector, ports), not
the app.

---

## Debugging Deployments

### Rollout Issues

```bash
kubectl rollout status deployment/<name>
```

If a rollout is stuck:

```bash
kubectl rollout status deployment/<name>
```

```
Waiting for deployment "myapp" rollout to finish: 1 out of 3 new replicas have been updated...
```

Check the new ReplicaSet:

```bash
kubectl get replicasets -l app=myapp
```

```
NAME              DESIRED   CURRENT   READY   AGE
myapp-abc123      3         3         3       1h     # old
myapp-def456      1         1         0       5m     # new (stuck)
```

The new ReplicaSet has 1 Pod but it's not ready. Describe that Pod:

```bash
kubectl get pods -l app=myapp --sort-by=.metadata.creationTimestamp
kubectl describe pod <newest-pod>
```

### Quick Rollback

```bash
kubectl rollout undo deployment/<name>
```

This reverts to the previous version immediately.

### Deployment History

```bash
kubectl rollout history deployment/<name>
kubectl rollout history deployment/<name> --revision=2
```

---

## The Systematic Debugging Process

When something is broken, follow this process:

### Step 1: What's the Current State?

```bash
kubectl get pods -o wide
kubectl get events --sort-by=.metadata.creationTimestamp
```

### Step 2: Zoom Into the Broken Resource

```bash
kubectl describe pod <broken-pod>
```

Read the Events section. Read the Conditions section. Read the container
statuses.

### Step 3: Check the Application

```bash
kubectl logs <broken-pod>
kubectl logs <broken-pod> --previous
```

### Step 4: Get Inside

```bash
kubectl exec -it <pod> -- /bin/sh
# Check env vars, files, network, DNS
env
cat /etc/resolv.conf
wget -qO- http://other-service:80
ls -la /data
```

### Step 5: Check the Surroundings

```bash
kubectl get svc <service-name>
kubectl get endpoints <service-name>
kubectl get networkpolicies
kubectl describe node <node-name>
```

### Step 6: Escalate

If Pod-level debugging doesn't reveal the issue:

```bash
kubectl debug node/<node-name> -it --image=busybox
kubectl logs -n kube-system <kube-proxy-pod>
kubectl logs -n kube-system <coredns-pod>
```

---

## Real-World Debugging Scenarios

### Scenario 1: App Works Locally but Not in Kubernetes

**Symptoms**: Pod starts, logs show the app running, but Service returns
connection refused.

**Investigation**:

```bash
kubectl exec <pod> -- wget -qO- localhost:8080
```

Works from inside the Pod? Good, app is running.

```bash
kubectl exec <other-pod> -- wget -qO- <pod-ip>:8080
```

Doesn't work? The app is binding to `127.0.0.1` instead of `0.0.0.0`.

**Root cause**: many frameworks default to listening on localhost only. In
Kubernetes, traffic comes from outside the container, so the app must listen on
`0.0.0.0`.

Go fix:
```go
http.ListenAndServe(":8080", nil) // binds to 0.0.0.0
```

Node fix:
```typescript
app.listen(8080, "0.0.0.0");
```

### Scenario 2: Intermittent Failures

**Symptoms**: requests sometimes succeed, sometimes fail. Some Pods are healthy,
others aren't.

**Investigation**:

```bash
kubectl get pods -o wide
```

Check that all replicas are running. Check each Pod individually:

```bash
for pod in $(kubectl get pods -l app=myapp -o name); do
  echo "Testing $pod..."
  kubectl exec $pod -- wget -qO- localhost:8080/health
done
```

One Pod returns an error. Check its logs:

```bash
kubectl logs <failing-pod>
```

Maybe it connected to a different database, has a bad config, or has a stale
cache.

### Scenario 3: Pod Stuck in Terminating

**Symptoms**: `kubectl delete pod <name>` runs but the Pod stays in
`Terminating` state.

```bash
kubectl get pod <name>
```

```
NAME    READY   STATUS        RESTARTS   AGE
stuck   1/1     Terminating   0          30m
```

**Investigation**:

```bash
kubectl describe pod stuck
```

Look for:
- **Finalizers**: something is preventing deletion
- **PreStop hooks**: a PreStop command is hanging

**Force delete** (last resort):

```bash
kubectl delete pod stuck --grace-period=0 --force
```

Common causes:
- A finalizer that's stuck (the controller managing it crashed)
- PreStop hook running a command that never completes
- The node is unreachable (Pod is "Terminating" but the kubelet on that node
  can't actually stop it)

### Scenario 4: Mounting Issues

**Symptoms**: Pod stuck in `ContainerCreating` for a long time.

```bash
kubectl describe pod <name>
```

```
Events:
  Warning  FailedMount  10s  Unable to attach or mount volumes:
           timeout expired waiting for volumes to attach or mount for pod
```

Common causes:
- PVC not bound (no matching PV available)
- Volume is already attached to another node (EBS volumes are single-attach)
- Storage class doesn't exist
- Node can't reach the storage backend

---

## Quick Reference: Error → First Command

| What You See | First Command |
|-------------|---------------|
| CrashLoopBackOff | `kubectl logs <pod> --previous` |
| ImagePullBackOff | `kubectl describe pod <pod>` (check image name) |
| Pending | `kubectl describe pod <pod>` (check events for scheduling failure) |
| OOMKilled | `kubectl describe pod <pod>` (check memory limits) |
| Service unreachable | `kubectl get endpoints <svc>` (check for empty endpoints) |
| DNS failure | `kubectl exec <pod> -- nslookup <service>` |
| Connection refused | `kubectl exec <pod> -- wget -qO- <pod-ip>:<port>` |
| Slow responses | `kubectl top pods` (check CPU throttling) |
| ContainerCreating (stuck) | `kubectl describe pod <pod>` (check volume mounts) |
| Terminating (stuck) | `kubectl describe pod <pod>` (check finalizers) |
| Init:Error | `kubectl logs <pod> -c <init-container-name>` |
| Forbidden (RBAC) | `kubectl auth can-i <verb> <resource> --as <user>` |

---

## Exercises

### Exercise 1: Debug the Deployment

Apply this broken deployment and fix all the issues:

```yaml
# file: broken-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mystery-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mystery
  template:
    metadata:
      labels:
        app: mystery-app
    spec:
      containers:
      - name: app
        image: hashicorp/http-echoo
        args: ["-text=working"]
        ports:
        - containerPort: 5678
        resources:
          requests:
            cpu: 100m
            memory: 64Mi
---
apiVersion: v1
kind: Service
metadata:
  name: mystery-app
spec:
  selector:
    app: mystery
  ports:
  - port: 80
    targetPort: 8080
```

There are multiple bugs. Find and fix them all:
1. Image name typo
2. Selector mismatch between Deployment spec.selector and template labels
3. Service targetPort doesn't match container port

### Exercise 2: Diagnose CrashLoopBackOff

```yaml
# file: crashing-app.yaml
apiVersion: v1
kind: Pod
metadata:
  name: crashing-app
spec:
  containers:
  - name: app
    image: busybox
    command:
    - sh
    - -c
    - |
      echo "Checking for required config..."
      if [ ! -f /config/app.conf ]; then
        echo "ERROR: /config/app.conf not found!"
        exit 1
      fi
      echo "Starting application..."
      sleep infinity
```

1. Apply and observe the crash
2. Read the logs to understand why
3. Fix it by adding a ConfigMap with the required file
4. Verify the Pod runs successfully

### Exercise 3: Service Connectivity Chain

Deploy a three-tier application and break different parts of the chain:

1. Deploy frontend → backend → database
2. Verify the full chain works
3. Break the backend Service selector — debug and fix
4. Break the database with wrong target port — debug and fix
5. Add a NetworkPolicy that blocks frontend → database but allow
   frontend → backend → database — verify

### Exercise 4: Resource-Based Failures

1. Create a ResourceQuota with `pods: 3` in a namespace
2. Deploy a Deployment with 5 replicas
3. Observe that only 3 Pods are created
4. Find the error message in events
5. Increase the quota and watch the remaining Pods create

### Exercise 5: The Full Investigation

Deploy this and diagnose every issue without looking at the YAML:

```yaml
# file: full-investigation.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: investigation
---
apiVersion: v1
kind: ResourceQuota
metadata:
  name: tight-quota
  namespace: investigation
spec:
  hard:
    pods: "2"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: suspect
  namespace: investigation
spec:
  replicas: 3
  selector:
    matchLabels:
      app: suspect
  template:
    metadata:
      labels:
        app: suspect
    spec:
      containers:
      - name: app
        image: busybox
        command: ["sh", "-c", "sleep infinity"]
        resources:
          requests:
            memory: 10Mi
          limits:
            memory: 10Mi
      initContainers:
      - name: init
        image: busybox
        command: ["sh", "-c", "nslookup config-service.investigation"]
```

Issues to find:
1. ResourceQuota allows only 2 Pods but Deployment wants 3
2. Init container waits for a Service that doesn't exist
3. Memory limit is very low (may cause issues with some workloads)

Use only `kubectl` commands (get, describe, logs, events) to find all issues.
Document your debugging process step by step.

---

## What Would Happen If...

**Q: kubectl exec fails with "container not found"?**
A: The container crashed between when you ran `get pods` and `exec`. Use
`kubectl logs --previous` to see what happened. If the container is in
CrashLoopBackOff, there's a brief window when it's running — time your exec
to catch it, or use `kubectl debug` instead.

**Q: You can't reach the API server (kubectl commands hang)?**
A: Check your kubeconfig: `kubectl config current-context`. Check if the cluster
is running: `docker ps` (for kind). Check your network connection. Check if
the API server Pod is healthy in the control plane node.

**Q: Events show nothing useful?**
A: Events expire after 1 hour by default. If the problem happened earlier,
events are gone. This is why centralized logging is essential — export events
to your logging system for long-term retention.

**Q: Logs show nothing because the container exits immediately?**
A: Use `kubectl logs --previous` for the last container instance. Or temporarily
change the command to `sleep infinity` to keep the container alive while you
debug with `exec`.

**Q: Everything looks fine in kubectl but the app doesn't work?**
A: The issue is inside the application, not in Kubernetes. Use `kubectl exec`
to get inside, check environment variables, test connectivity to dependencies,
and look at the app's own health checks. Kubernetes can only tell you about
infrastructure issues — application logic bugs need application-level
debugging.

---

## Key Takeaways

1. **Start with `kubectl get pods`** — the STATUS column gives you the first
   clue
2. **`kubectl describe` is your best friend** — Events section tells the story
3. **`kubectl logs --previous`** — essential for CrashLoopBackOff
4. **Empty endpoints = selector mismatch** — the most common Service issue
5. **Exit code 137 = OOMKilled** — increase memory limit or fix the leak
6. **Pending = scheduling failure** — check resources, node selectors, taints
7. **Debug systematically**: state → describe → logs → exec → surroundings
8. **`kubectl debug`** for minimal containers without shells
9. **Port-forward bypasses the Service** — useful for isolating whether the
   issue is in the app or the networking layer

---

## Cleanup

```bash
kubectl delete -f crash-loop.yaml 2>/dev/null
kubectl delete -f image-pull-fail.yaml 2>/dev/null
kubectl delete -f pending-pod.yaml 2>/dev/null
kubectl delete -f oom-kill.yaml 2>/dev/null
kubectl delete -f broken-service.yaml 2>/dev/null
kubectl delete -f init-fail.yaml 2>/dev/null
kubectl delete pod dnsutils 2>/dev/null
kubectl delete namespace investigation 2>/dev/null
kind delete cluster --name debug-lab
```

---

This is the final lesson in the Kubernetes track. You now have the knowledge to
deploy, configure, secure, observe, and debug applications on Kubernetes. The
next step is practice — build something real, break it, fix it, and repeat.

Back to: [Kubernetes Roadmap](./00-roadmap.md)
