# Lesson 14: DaemonSets and Jobs — Every Node and Batch Work

## The Big Picture

Not all work in a building is the same. You have three types of workers:

**DaemonSet = The janitor on every floor.** You don't need 10 janitors on one
floor and zero on another. You need exactly one per floor, guaranteed. When a
new floor is added to the building, a janitor automatically appears. When a
floor is demolished, that janitor's job ends. This is a DaemonSet: exactly one
Pod on every node.

**Job = The moving company.** You hire them for one specific task: move furniture
from office A to office B. Once done, they leave. You don't need them running
24/7. If a mover drops a box, they pick it up and try again. This is a Job:
run-to-completion work.

**CronJob = The weekly cleaning crew.** Every Friday at 6 PM, a cleaning crew
shows up, does their work, and leaves. They come back next Friday. This is a
CronJob: scheduled, recurring Jobs.

---

## Prerequisites

- Lesson 04 (Deployments)
- Lesson 08 (Namespaces)

```bash
kind create cluster --name workloads-lab --config - <<EOF
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
- role: worker
- role: worker
- role: worker
EOF
```

We create 3 worker nodes so DaemonSets have something interesting to
demonstrate.

---

## Part 1: DaemonSets

### What DaemonSets Do

A DaemonSet ensures that **every node** (or every node matching certain
criteria) runs exactly one copy of a Pod. When a new node joins the cluster,
the DaemonSet automatically schedules a Pod on it. When a node is removed, the
Pod is garbage collected.

### Common DaemonSet Use Cases

| Use Case | Example |
|----------|---------|
| Log collection | Fluentd, Fluent Bit, Filebeat |
| Monitoring agents | Prometheus Node Exporter, Datadog agent |
| Network plugins | Calico, Cilium, kube-proxy |
| Storage drivers | CSI node plugins |
| Security agents | Falco, Twistlock |

All of these share the same pattern: you need exactly one instance per node
because they monitor or configure something node-level.

### Your First DaemonSet

Let's deploy a simple log collector that tails node logs:

```yaml
# file: log-collector-ds.yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: log-collector
  labels:
    app: log-collector
spec:
  selector:
    matchLabels:
      app: log-collector
  template:
    metadata:
      labels:
        app: log-collector
    spec:
      containers:
      - name: logger
        image: busybox
        command:
        - sh
        - -c
        - |
          echo "Log collector started on $(hostname)"
          while true; do
            echo "[$(date)] Collecting logs from $(hostname)..."
            sleep 30
          done
        resources:
          requests:
            cpu: 50m
            memory: 64Mi
          limits:
            cpu: 100m
            memory: 128Mi
```

```bash
kubectl apply -f log-collector-ds.yaml
```

### Verify: One Pod Per Node

```bash
kubectl get pods -l app=log-collector -o wide
```

```
NAME                  READY   STATUS    NODE
log-collector-abc12   1/1     Running   workloads-lab-worker
log-collector-def34   1/1     Running   workloads-lab-worker2
log-collector-ghi56   1/1     Running   workloads-lab-worker3
```

Three worker nodes, three Pods. Exactly one per node.

```bash
kubectl get daemonset log-collector
```

```
NAME            DESIRED   CURRENT   READY   UP-TO-DATE   AVAILABLE   NODE SELECTOR   AGE
log-collector   3         3         3       3            3           <none>          30s
```

- **DESIRED**: number of nodes that should run the Pod
- **CURRENT**: number of Pods created
- **READY**: number of Pods ready
- **AVAILABLE**: number of Pods available

### DaemonSet with Node Selectors

Maybe you only want the log collector on nodes with SSD storage:

```yaml
# file: ssd-only-ds.yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: ssd-monitor
spec:
  selector:
    matchLabels:
      app: ssd-monitor
  template:
    metadata:
      labels:
        app: ssd-monitor
    spec:
      nodeSelector:
        disk-type: ssd
      containers:
      - name: monitor
        image: busybox
        command: ["sh", "-c", "echo 'Monitoring SSD on $(hostname)' && sleep infinity"]
```

Label one node and apply:

```bash
kubectl label nodes workloads-lab-worker disk-type=ssd
kubectl apply -f ssd-only-ds.yaml
```

```bash
kubectl get pods -l app=ssd-monitor -o wide
```

Only one Pod — on the labeled node. Label another node and watch a Pod
automatically appear:

```bash
kubectl label nodes workloads-lab-worker2 disk-type=ssd
kubectl get pods -l app=ssd-monitor -o wide
```

Now two Pods. The DaemonSet controller reacts to node label changes.

### Real-World DaemonSet: Node Exporter

Prometheus Node Exporter collects hardware and OS metrics from every node:

```yaml
# file: node-exporter-ds.yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: node-exporter
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app: node-exporter
  template:
    metadata:
      labels:
        app: node-exporter
    spec:
      hostNetwork: true
      hostPID: true
      containers:
      - name: node-exporter
        image: prom/node-exporter:v1.7.0
        args:
        - --path.procfs=/host/proc
        - --path.sysfs=/host/sys
        - --path.rootfs=/host/root
        ports:
        - containerPort: 9100
          hostPort: 9100
          name: metrics
        volumeMounts:
        - name: proc
          mountPath: /host/proc
          readOnly: true
        - name: sys
          mountPath: /host/sys
          readOnly: true
        - name: root
          mountPath: /host/root
          readOnly: true
        resources:
          requests:
            cpu: 100m
            memory: 64Mi
          limits:
            cpu: 200m
            memory: 128Mi
      tolerations:
      - operator: Exists
      volumes:
      - name: proc
        hostPath:
          path: /proc
      - name: sys
        hostPath:
          path: /sys
      - name: root
        hostPath:
          path: /
```

Key details:
- **hostNetwork: true** — uses the node's network directly (needed to collect
  network metrics)
- **hostPID: true** — sees all processes on the node
- **hostPath volumes** — mounts node directories into the Pod
- **tolerations** — runs on ALL nodes, even ones with taints (like control
  plane nodes)

### DaemonSet Update Strategies

**RollingUpdate (Default)**: updates Pods one at a time across nodes.

```yaml
spec:
  updateStrategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
```

`maxUnavailable: 1` means at most one node has its DaemonSet Pod unavailable
during the update. For a log collector, you might tolerate `maxUnavailable: 2`
to speed up rollouts.

**OnDelete**: Pods are only updated when manually deleted. Use when you want
full control over which nodes get updated first.

### DaemonSet vs. Deployment with nodeAffinity

You might wonder: "Can I achieve the same thing with a Deployment and node
affinity?" Technically, sort of. But:

- A Deployment won't automatically add Pods when new nodes join
- A Deployment might schedule 2 Pods on one node and 0 on another
- DaemonSets are specifically designed for the "one per node" pattern

Use the right tool for the job.

---

## Part 2: Jobs

### What Jobs Do

A Job creates one or more Pods and ensures they successfully complete. Unlike a
Deployment (which keeps Pods running forever), a Job runs until the work is
done, then the Pods exit with status 0.

Think of the difference like this: a Deployment is a restaurant that stays open
24/7 with staff always on duty. A Job is catering for a single event — prep,
serve, clean up, done.

### Your First Job

```yaml
# file: simple-job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: pi-calculator
spec:
  template:
    spec:
      containers:
      - name: pi
        image: perl:5.34
        command: ["perl", "-Mbignum=bpi", "-wle", "print bpi(2000)"]
      restartPolicy: Never
```

```bash
kubectl apply -f simple-job.yaml
```

Watch it run:

```bash
kubectl get jobs -w
```

```
NAME            COMPLETIONS   DURATION   AGE
pi-calculator   0/1           3s         3s
pi-calculator   1/1           8s         8s
```

The Pod ran, calculated 2000 digits of pi, and exited:

```bash
kubectl get pods -l job-name=pi-calculator
```

```
NAME                  READY   STATUS      RESTARTS   AGE
pi-calculator-abc12   0/1     Completed   0          15s
```

Status is `Completed`, not `Running`. The Pod stays around so you can check its
logs:

```bash
kubectl logs -l job-name=pi-calculator
```

### restartPolicy for Jobs

Jobs require `restartPolicy: Never` or `restartPolicy: OnFailure`. You cannot
use `Always` (the default for Deployments) because that would restart the Pod
forever, defeating the purpose.

- **Never**: if the Pod fails, create a new Pod (old Pod stays for debugging)
- **OnFailure**: if the Pod fails, restart the same Pod (retries in-place)

### Job Failure Handling

```yaml
# file: failing-job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: flaky-task
spec:
  backoffLimit: 4
  activeDeadlineSeconds: 120
  template:
    spec:
      containers:
      - name: task
        image: busybox
        command: ["sh", "-c", "echo 'Attempting task...' && exit 1"]
      restartPolicy: Never
```

- **backoffLimit: 4** — retry up to 4 times before marking the Job as failed.
  Each retry has exponential backoff (10s, 20s, 40s, 80s).
- **activeDeadlineSeconds: 120** — the entire Job must complete within 2
  minutes, regardless of retries.

```bash
kubectl apply -f failing-job.yaml
kubectl get pods -l job-name=flaky-task -w
```

You'll see multiple Pods created, each failing, with increasing delays between
attempts.

```bash
kubectl describe job flaky-task
```

The Events section shows the retry history.

### Practical Job: Database Migration

This is one of the most common Job use cases — running database migrations
before deploying a new version of your app:

```yaml
# file: db-migration-job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migrate-v42
spec:
  backoffLimit: 3
  activeDeadlineSeconds: 300
  template:
    metadata:
      labels:
        app: migration
        version: v42
    spec:
      containers:
      - name: migrate
        image: busybox
        command:
        - sh
        - -c
        - |
          echo "Starting database migration v42..."
          echo "Step 1: Adding 'email_verified' column to users table"
          sleep 2
          echo "Step 2: Backfilling email_verified for existing users"
          sleep 3
          echo "Step 3: Creating index on email_verified"
          sleep 1
          echo "Migration v42 completed successfully"
        env:
        - name: DATABASE_URL
          value: "postgres://user:pass@postgres:5432/mydb"
      restartPolicy: Never
```

In a real migration, the container would run something like:

```go
// Go migration
func main() {
    db := connectDB(os.Getenv("DATABASE_URL"))
    if err := goose.Up(db, "migrations/"); err != nil {
        log.Fatal(err)  // Non-zero exit → Job retries
    }
    // Zero exit → Job succeeds
}
```

```bash
kubectl apply -f db-migration-job.yaml
kubectl wait --for=condition=complete job/db-migrate-v42 --timeout=60s
kubectl logs -l job-name=db-migrate-v42
```

### Parallel Jobs

For batch processing, you can run multiple Pods simultaneously:

```yaml
# file: parallel-job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: batch-process
spec:
  completions: 10
  parallelism: 3
  template:
    spec:
      containers:
      - name: worker
        image: busybox
        command:
        - sh
        - -c
        - |
          TASK_ID=$((RANDOM % 1000))
          echo "Processing task ${TASK_ID} on $(hostname)"
          sleep $((RANDOM % 10 + 1))
          echo "Task ${TASK_ID} completed"
      restartPolicy: Never
```

- **completions: 10** — the Job needs 10 successful Pod completions total
- **parallelism: 3** — run up to 3 Pods at the same time

```bash
kubectl apply -f parallel-job.yaml
kubectl get pods -l job-name=batch-process -w
```

You'll see 3 Pods running simultaneously. As each completes, a new one starts
until all 10 completions are done.

```bash
kubectl get job batch-process -w
```

```
NAME            COMPLETIONS   DURATION   AGE
batch-process   0/10          3s         3s
batch-process   1/10          8s         8s
batch-process   2/10          11s        11s
...
batch-process   10/10         45s        45s
```

### Indexed Jobs

For work queues where each Pod needs to know which chunk to process:

```yaml
# file: indexed-job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: indexed-processor
spec:
  completions: 5
  parallelism: 3
  completionMode: Indexed
  template:
    spec:
      containers:
      - name: worker
        image: busybox
        command:
        - sh
        - -c
        - |
          echo "I am worker index ${JOB_COMPLETION_INDEX}"
          echo "Processing data chunk ${JOB_COMPLETION_INDEX} of 5"
          sleep 5
          echo "Chunk ${JOB_COMPLETION_INDEX} done"
      restartPolicy: Never
```

Each Pod gets a unique `JOB_COMPLETION_INDEX` (0 through 4). This is perfect
for "process files 0-999 in 5 chunks" scenarios.

```bash
kubectl apply -f indexed-job.yaml
kubectl get pods -l job-name=indexed-processor -w
```

### Automatic Cleanup: TTL

By default, completed Job Pods hang around for debugging. Use TTL to auto-clean:

```yaml
spec:
  ttlSecondsAfterFinished: 300
```

The Job and its Pods are deleted 5 minutes after completion. Essential for
CronJobs that would otherwise accumulate thousands of completed Pods.

---

## Part 3: CronJobs

### What CronJobs Do

A CronJob creates a Job on a schedule. It uses the same cron syntax you know
from Unix:

```
┌───────── minute (0–59)
│ ┌───────── hour (0–23)
│ │ ┌───────── day of month (1–31)
│ │ │ ┌───────── month (1–12)
│ │ │ │ ┌───────── day of week (0–6, Sunday=0)
│ │ │ │ │
* * * * *
```

### Common Schedules

| Schedule | Cron Expression |
|----------|----------------|
| Every minute | `*/1 * * * *` |
| Every hour | `0 * * * *` |
| Every day at midnight | `0 0 * * *` |
| Every Monday at 9 AM | `0 9 * * 1` |
| First of every month | `0 0 1 * *` |
| Every 15 minutes | `*/15 * * * *` |

### Your First CronJob

A database backup that runs every day at 2 AM:

```yaml
# file: backup-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: db-backup
spec:
  schedule: "0 2 * * *"
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 3
  jobTemplate:
    spec:
      backoffLimit: 2
      activeDeadlineSeconds: 3600
      template:
        spec:
          containers:
          - name: backup
            image: busybox
            command:
            - sh
            - -c
            - |
              echo "Starting database backup at $(date)"
              echo "Dumping production database..."
              sleep 5
              echo "Compressing backup..."
              sleep 2
              echo "Uploading to S3..."
              sleep 3
              echo "Backup completed at $(date)"
          restartPolicy: OnFailure
```

Key fields:

- **schedule**: cron expression for when to run
- **concurrencyPolicy**: what happens if the previous Job is still running
  - `Allow` — run concurrently (multiple Jobs at once)
  - `Forbid` — skip this run if the previous is still going
  - `Replace` — kill the previous Job and start a new one
- **successfulJobsHistoryLimit**: how many completed Jobs to keep (for logs)
- **failedJobsHistoryLimit**: how many failed Jobs to keep (for debugging)

```bash
kubectl apply -f backup-cronjob.yaml
```

For testing, let's create a CronJob that runs every minute:

```yaml
# file: frequent-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: health-report
spec:
  schedule: "*/1 * * * *"
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 1
  jobTemplate:
    spec:
      ttlSecondsAfterFinished: 120
      template:
        spec:
          containers:
          - name: report
            image: busybox
            command:
            - sh
            - -c
            - |
              echo "Health report generated at $(date)"
              echo "Status: all systems operational"
          restartPolicy: Never
```

```bash
kubectl apply -f frequent-cronjob.yaml
```

Wait a couple minutes and check:

```bash
kubectl get cronjobs
```

```
NAME            SCHEDULE      SUSPEND   ACTIVE   LAST SCHEDULE   AGE
db-backup       0 2 * * *     False     0        <none>          60s
health-report   */1 * * * *   False     0        30s             120s
```

```bash
kubectl get jobs
```

You'll see Jobs created by the CronJob, named like `health-report-28401234`.

### Manually Triggering a CronJob

Don't want to wait for the schedule? Create a Job from the CronJob:

```bash
kubectl create job --from=cronjob/db-backup manual-backup
kubectl logs -l job-name=manual-backup
```

### Suspending a CronJob

Pause without deleting:

```bash
kubectl patch cronjob db-backup -p '{"spec":{"suspend":true}}'
```

Resume:

```bash
kubectl patch cronjob db-backup -p '{"spec":{"suspend":false}}'
```

---

## Relating to Go/TypeScript Patterns

### DaemonSets = Middleware in Every Service Instance

In an Express app, you add middleware that runs on every request:

```typescript
app.use(requestLogger);
app.use(metricsCollector);
```

DaemonSets are the infrastructure equivalent — they add capabilities to every
node: logging, monitoring, networking. You don't configure them per-app. They're
platform-level concerns.

### Jobs = Script Runners

In Go, you might have a `cmd/migrate/main.go` that runs once:

```go
func main() {
    db := connectDB()
    if err := runMigrations(db); err != nil {
        log.Fatal(err)
    }
    fmt.Println("migrations complete")
}
```

A Kubernetes Job is the production way to run this. Instead of SSHing into a
server and running `go run cmd/migrate/main.go`, you submit a Job and
Kubernetes handles retries, logging, and cleanup.

### CronJobs = Your Cron Tab, But Better

Instead of a `crontab` on a single server that you hope doesn't die:

```
0 2 * * * /usr/local/bin/backup.sh
```

A CronJob runs in the cluster with retry logic, history tracking, and no single
point of failure.

---

## Exercises

### Exercise 1: DaemonSet Lifecycle

1. Deploy a DaemonSet that writes the node hostname to a file every 10 seconds
2. Verify one Pod per worker node
3. Add a new node to the kind cluster: `docker exec ... kind join`
4. Verify the DaemonSet automatically schedules a Pod on the new node
5. Use a nodeSelector to restrict the DaemonSet to only 2 of 3 nodes
6. Remove the label from one node and verify the Pod is removed

### Exercise 2: Job Retry Behavior

1. Create a Job that fails 50% of the time (use `$((RANDOM % 2))` as exit code)
2. Set `backoffLimit: 6`
3. Watch the retries and note the exponential backoff timing
4. Check `kubectl describe job` to see the failure history
5. Modify to use `restartPolicy: OnFailure` instead of `Never`
6. Observe the difference (in-place restarts vs new Pods)

### Exercise 3: Parallel Batch Processing

1. Create an indexed Job with 10 completions and parallelism of 4
2. Each worker should "process" a file named `data-{index}.csv`
3. Log the start time, processing time (random 1-10 seconds), and end time
4. Observe how the scheduler fills empty slots as workers complete
5. Calculate total wall-clock time vs sum of all processing times

### Exercise 4: CronJob Monitoring

1. Create a CronJob that runs every minute
2. Make it report the cluster's Pod count using the Kubernetes API
   (hint: use a ServiceAccount with appropriate RBAC)
3. Watch it run for 5 minutes
4. Check the job history
5. Suspend it, verify no new Jobs are created
6. Resume it, verify Jobs start again

### Exercise 5: Migration Pipeline

Build a deployment pipeline using Jobs:

1. Create a Job that "runs migrations" (simulated with echo statements)
2. Only after the migration Job succeeds, deploy the new version of your app
3. Use `kubectl wait --for=condition=complete job/migration` in a script
4. If the migration fails, the deployment should not proceed

```bash
#!/bin/bash
kubectl apply -f migration-job.yaml
kubectl wait --for=condition=complete job/db-migrate --timeout=120s
if [ $? -eq 0 ]; then
    echo "Migration succeeded, deploying app..."
    kubectl apply -f app-deployment.yaml
else
    echo "Migration failed, aborting deployment"
    exit 1
fi
```

---

## What Would Happen If...

**Q: You delete a DaemonSet Pod manually?**
A: The DaemonSet controller immediately creates a replacement on the same node.
It's like a Deployment's self-healing, but node-aware.

**Q: A node becomes NotReady while running a DaemonSet Pod?**
A: The DaemonSet Pod stays on the node (it can't be rescheduled — DaemonSet
Pods are bound to their node). When the node comes back, the Pod resumes.

**Q: A CronJob's previous run is still going when the next schedule triggers?**
A: Depends on `concurrencyPolicy`. With `Forbid`, the new run is skipped. With
`Replace`, the old run is killed. With `Allow`, both run simultaneously.
`Forbid` is safest for most cases — you don't want two backup scripts
stomping on each other.

**Q: A Job Pod exits with code 0 but the work actually failed silently?**
A: Kubernetes considers exit code 0 as success. The Job marks as Complete. Your
app must use non-zero exit codes for failures. In Go, this means
`os.Exit(1)` or `log.Fatal()`. In TypeScript, `process.exit(1)`. Never
swallow errors.

**Q: You scale a DaemonSet?**
A: You can't set `replicas` on a DaemonSet. It's always one-per-node. To
control which nodes, use `nodeSelector` or `affinity` rules. To get more Pods
on a node, use a Deployment.

**Q: A CronJob runs for longer than the gap between schedules?**
A: If it takes 3 hours and runs daily, that's fine — it finishes before the
next run. If it takes 25 hours and runs daily, you'll have overlapping Jobs
(unless `concurrencyPolicy: Forbid`). Set `activeDeadlineSeconds` as a safety
net.

---

## Key Takeaways

1. **DaemonSets** = one Pod per node. Use for logging, monitoring, networking
2. **Jobs** = run-to-completion. Use for migrations, batch processing, one-off
   tasks
3. **CronJobs** = scheduled Jobs. Use for backups, reports, cleanup
4. **DaemonSets react to node changes** — Pods automatically appear/disappear
   as nodes join/leave
5. **Jobs retry with exponential backoff** — use `backoffLimit` and
   `activeDeadlineSeconds` for safety
6. **CronJobs need concurrencyPolicy** — `Forbid` prevents overlapping runs
7. **Exit codes matter** — 0 = success, non-zero = failure. Kubernetes relies
   on this for retry logic
8. **TTL cleanup** — use `ttlSecondsAfterFinished` to auto-delete completed
   Jobs

---

## Cleanup

```bash
kubectl delete daemonset log-collector ssd-monitor 2>/dev/null
kubectl delete job pi-calculator flaky-task db-migrate-v42 batch-process indexed-processor 2>/dev/null
kubectl delete cronjob db-backup health-report 2>/dev/null
kind delete cluster --name workloads-lab
```

---

Next: [Lesson 15: Horizontal Pod Autoscaler →](./15-hpa.md)
