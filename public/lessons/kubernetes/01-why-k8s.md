# Why Kubernetes Exists

## The Problem You Already Have

You wrote a Go API. It runs in a Docker container. Works great on your laptop. You deploy it to a server. Still great. Life is good.

Then your startup grows. Now you have:

- 100 containers (APIs, workers, databases, caches, cron jobs)
- 20 servers across two cloud regions
- Traffic spikes at 9 AM when everyone logs in
- A deploy every afternoon

And suddenly you're answering questions Docker was never designed to answer:

**Which container goes on which server?** Server A has 2GB of RAM left, Server B has 8GB. Your new container needs 4GB. You have to check every server manually, find one with space, and ssh in to start it.

**What happens when a server dies?** At 3 AM, Server C loses a disk. It was running your payment processor, your notification service, and two worker queues. You get paged. You ssh into other servers. You restart each container one by one. You miss one. Customers notice before you do.

**How do you update without downtime?** You need to roll out a new version of the API. You can't just stop the old one and start the new one — that's 30 seconds of downtime. You need to start the new version alongside the old one, shift traffic over, verify it's healthy, then kill the old one. On every server. For every service. Manually.

**How do you scale for a traffic spike?** Marketing sends a newsletter at noon. Traffic triples. You need 10 more API containers. Right now. By the time you've ssh'd into servers and started containers, the spike is over and customers have bounced.

This is the problem Kubernetes solves. Not for one container. For hundreds.

---

## The Airline Operations Center Analogy

Think of a major airport — say, O'Hare during Thanksgiving.

There are hundreds of planes (your containers) and dozens of gates (your servers). The airline operations center has to:

- **Assign planes to gates** based on which gates are available, which are the right size, and which terminals make sense for connections.
- **Reroute when a gate breaks** — if Gate B12's jetbridge malfunctions, they don't cancel the flight. They reassign it to another gate and announce the change.
- **Coordinate rolling gate changes** — when they need to renovate gates, they don't close the whole terminal. They close one gate at a time, shifting flights around.
- **Scale up for holidays** — they open overflow parking, activate extra gates, bring in temporary staff. When the rush is over, they scale back down.
- **Handle the unexpected** — a plane diverts due to weather. The ops center finds a gate, assigns ground crew, rebooks passengers. Automatically, based on rules.

You don't want the pilot making gate decisions. You don't want humans manually tracking which gates are free. You want a system that takes your intent ("I need to land this 737") and figures out the rest.

**Kubernetes is that operations center for your containers.**

You say: "I want 3 copies of my API running." Kubernetes decides which servers to put them on, starts them, monitors them, and restarts them if they crash. You describe what you want. Kubernetes makes it happen.

---

## Before Kubernetes: The Manual Era

Let's trace the evolution. If you've deployed Go or TypeScript apps, you've probably lived through some of these stages.

### Stage 1: One Server, One App

```
ssh deploy@server
git pull
go build -o app
./app &
```

Problems: no isolation, port conflicts, "works on my machine" issues, can't run two versions.

### Stage 2: Docker on a Single Server

```
docker build -t my-app:v2 .
docker stop my-app
docker run -d --name my-app -p 8080:8080 my-app:v2
```

Better. Isolation works. But you're still on one server. If it dies, everything dies.

### Stage 3: Docker Compose on Multiple Servers

You write a `docker-compose.yml`. But Compose only manages one machine. So you have a `docker-compose.yml` per server. You ssh into each server and run `docker-compose up -d`. You write bash scripts to coordinate deploys across servers.

```bash
for server in server1 server2 server3; do
  ssh deploy@$server "cd /app && docker-compose pull && docker-compose up -d"
done
```

Problems:
- No automatic placement (you hardcode which services go where)
- No automatic recovery (if a container crashes, nobody restarts it until your monitoring alerts fire)
- No rolling updates (you take each server offline briefly)
- No service discovery (you hardcode IP addresses in config)
- Scaling means editing compose files and redeploying manually
- Load balancing is DIY (nginx config, haproxy)

### Stage 4: "Maybe We Need an Orchestrator"

This is where Kubernetes enters. You stop managing individual servers and start managing a cluster. You stop placing containers and start declaring intent.

---

## Google Borg and the Birth of Kubernetes

Kubernetes didn't come from nowhere. Google had this problem at planet scale since the early 2000s.

Google built an internal system called **Borg** that managed every workload at Google — Search, Gmail, YouTube, Maps — across millions of servers. Borg was the airline operations center for all of Google's infrastructure.

In 2014, Google open-sourced the ideas from Borg (not the code — the concepts) as **Kubernetes** (Greek for "helmsman" — the person who steers the ship). The key designers were engineers who'd built and operated Borg for years.

Why did Google give this away? Same reason they open-sourced Android. If everyone uses Kubernetes, everyone builds on cloud infrastructure, and Google sells cloud infrastructure. But unlike Android, Kubernetes became truly multi-cloud. It runs the same way on AWS, GCP, Azure, or your own servers.

The timeline:
- 2003-2004: Google develops Borg internally
- 2014: Kubernetes announced, based on Borg concepts
- 2015: Kubernetes 1.0 released, donated to CNCF (Cloud Native Computing Foundation)
- 2017-2018: All major cloud providers offer managed Kubernetes (EKS, GKE, AKS)
- Today: The default way to run containers in production

---

## Declarative vs. Imperative

This is the most important mental shift. If you've used Terraform, you already understand this. If you come from writing Go or TypeScript deploy scripts, this will feel different.

### Imperative: You Tell It What to Do

```bash
docker run -d --name api -p 8080:8080 my-app:v1
docker run -d --name api2 -p 8081:8080 my-app:v1
docker run -d --name api3 -p 8082:8080 my-app:v1
```

You give step-by-step instructions. If one container dies, you have to notice and run the command again. If you want to scale to 5, you run two more commands. If you lose the terminal history, you don't know what the desired state was.

This is like giving a taxi driver turn-by-turn directions: "Go left, then right, then straight for two blocks, then right again."

### Declarative: You Tell It What You Want

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
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
          image: my-app:v1
          ports:
            - containerPort: 8080
```

You describe the end state: "I want 3 copies of my-app:v1 running." Kubernetes figures out the steps. If one dies, Kubernetes starts a new one — you didn't ask it to, it just knows the desired state is 3 and the current state is 2.

This is like telling the taxi driver the destination: "Take me to O'Hare Airport." The driver figures out the route. If there's traffic, they reroute. You don't care how — you just want to get there.

### The Reconciliation Loop

This is the engine that powers everything in Kubernetes. It's an infinite loop:

```
while true:
    current_state = observe()
    desired_state = read_config()
    if current_state != desired_state:
        take_action_to_fix(current_state, desired_state)
    sleep(interval)
```

You said 3 replicas. There are 2 running. Kubernetes creates 1 more. You said 3 replicas. There are 4 running (somehow). Kubernetes kills 1. Always converging toward what you declared.

As a Go engineer, you can think of it like a PID controller — constantly measuring the error between desired and actual, then applying corrections. As a TypeScript developer, think of it like React's virtual DOM: you declare the UI you want, React figures out the diff and applies the minimum changes.

---

## The Desired State Model in Practice

Let's make this concrete with a Go API deployment.

### Without Kubernetes (imperative)

You write a deploy script:

```bash
#!/bin/bash

SERVERS="server1 server2 server3"
IMAGE="my-go-api:v2.1.0"

for server in $SERVERS; do
  echo "Deploying to $server..."
  ssh deploy@$server "docker pull $IMAGE"
  ssh deploy@$server "docker stop go-api || true"
  ssh deploy@$server "docker rm go-api || true"
  ssh deploy@$server "docker run -d --name go-api -p 8080:8080 \
    -e DATABASE_URL=postgres://db.internal:5432/myapp \
    -e LOG_LEVEL=info \
    $IMAGE"

  echo "Checking health..."
  for i in {1..10}; do
    if ssh deploy@$server "curl -s localhost:8080/health" | grep -q ok; then
      echo "$server is healthy"
      break
    fi
    sleep 2
  done
done

echo "Updating load balancer..."
# manually reconfigure nginx upstream...
```

Problems with this script:
- No rollback if server3 fails mid-deploy
- No health checking before shifting traffic
- If the script crashes halfway, you have mixed versions
- You manually track which version runs where
- Scaling means editing the script and adding servers
- Secret management (DATABASE_URL) is in the script

### With Kubernetes (declarative)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: go-api
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: go-api
  template:
    metadata:
      labels:
        app: go-api
    spec:
      containers:
        - name: api
          image: my-go-api:v2.1.0
          ports:
            - containerPort: 8080
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: db-creds
                  key: url
            - name: LOG_LEVEL
              valueFrom:
                configMapKeyRef:
                  name: api-config
                  key: log_level
          readinessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 10
          resources:
            requests:
              cpu: 200m
              memory: 256Mi
            limits:
              cpu: 1000m
              memory: 512Mi
```

```bash
kubectl apply -f deployment.yaml
```

One command. Kubernetes handles:
- Finding nodes with available resources
- Rolling out one Pod at a time (maxSurge: 1, maxUnavailable: 0)
- Health checking each new Pod before killing the old one
- Automatic rollback if the new version fails readiness checks
- Service discovery (no load balancer reconfiguration needed)
- Secret injection from a separate, access-controlled Secret resource
- Config injection from a ConfigMap

To update the version: change `image: my-go-api:v2.2.0` and `kubectl apply` again. To scale: change `replicas: 5` and apply. To rollback: `kubectl rollout undo deployment/go-api`.

### The Same Pattern for TypeScript

If you deploy a Next.js or Express app, the YAML is nearly identical:

```yaml
containers:
  - name: web
    image: my-nextjs-app:v1.0.0
    ports:
      - containerPort: 3000
    env:
      - name: NEXT_PUBLIC_API_URL
        value: "http://go-api:80"
    readinessProbe:
      httpGet:
        path: /api/health
        port: 3000
```

The TypeScript frontend talks to the Go API via the Service DNS name (`go-api:80`). Kubernetes handles the networking. Your code just makes HTTP requests to a hostname.

---

## The docker-compose to Kubernetes Translation

If you currently use docker-compose, here's how concepts map:

| docker-compose | Kubernetes | Notes |
|---------------|-----------|-------|
| `services:` | Deployment + Service | Deployment for Pods, Service for networking |
| `image:` | `spec.containers[].image` | Same container image |
| `ports:` | Service `port`/`targetPort` | Port mapping via Service |
| `environment:` | ConfigMap or `env:` | ConfigMap for non-sensitive, Secret for sensitive |
| `volumes:` | PersistentVolumeClaim | PVC for persistent data |
| `depends_on:` | Init containers | Wait for dependencies before starting |
| `deploy.replicas:` | `spec.replicas` | Kubernetes manages this natively |
| `restart: always` | `restartPolicy: Always` | Default in Deployments |
| `networks:` | Not needed | Flat networking, every Pod can reach every other Pod |
| `docker-compose up` | `kubectl apply -f ./` | Apply all manifests |
| `docker-compose down` | `kubectl delete -f ./` | Remove all resources |
| `docker-compose logs` | `kubectl logs` | Follows the same concept |
| `docker-compose exec` | `kubectl exec` | Same concept, different command |

A docker-compose file like this:

```yaml
version: "3.8"
services:
  api:
    image: my-go-api:v1
    ports:
      - "8080:8080"
    environment:
      DATABASE_URL: postgres://postgres:secret@db:5432/myapp
    depends_on:
      - db

  db:
    image: postgres:16
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: myapp

volumes:
  pgdata:
```

Becomes these Kubernetes resources:
- Deployment + Service for `api`
- Deployment + Service + PVC + Secret for `db`
- ConfigMap for non-sensitive env vars
- Secret for database credentials

The concepts map cleanly. The syntax is more verbose because Kubernetes gives you more control over each aspect.

---

## What Kubernetes Actually Gives You

Let's map each problem back to a solution:

| Problem | Kubernetes Solution |
|---------|-------------------|
| Which server does this container go on? | **Scheduler** places Pods on nodes with available resources |
| What if a server dies? | **Controller** detects the failure, reschedules Pods elsewhere |
| How do I update without downtime? | **Rolling updates** — replace Pods one at a time |
| How do I handle traffic spikes? | **Horizontal Pod Autoscaler** — auto-scale based on CPU/memory |
| How do containers find each other? | **Service discovery** — DNS names for every service |
| How do I manage config across services? | **ConfigMaps and Secrets** — centralized config |
| How do I manage storage? | **PersistentVolumes** — storage that survives Pod restarts |
| How do I expose services to the internet? | **Ingress** — HTTP routing from external traffic to services |
| How do I limit resources per team? | **Namespaces and ResourceQuotas** — multi-tenancy |

---

## What Kubernetes Is NOT

Common misconceptions from engineers coming from simpler setups:

**It's not a PaaS.** Kubernetes doesn't build your code. It doesn't do CI/CD. It runs containers that you give it. You still need Docker (or another container builder) and a CI pipeline.

**It's not magic.** It's complex infrastructure software with a steep learning curve. It adds operational overhead. For 2 containers on 1 server, Kubernetes is overkill. Use Docker Compose.

**It's not just for microservices.** You can run a monolith in Kubernetes. Many companies do. The benefits (self-healing, scaling, rolling updates) apply to monoliths too.

**It's not a replacement for understanding networking.** You still need to understand DNS, TCP/UDP, load balancing, and TLS. Kubernetes automates these things but doesn't hide them.

---

## When NOT to Use Kubernetes

This is important. Kubernetes has costs:

- **Complexity tax**: More moving parts means more things that can break. API server goes down? Nothing deploys. etcd corruption? You lose cluster state.
- **Resource overhead**: The control plane itself consumes CPU and memory. On a 3-node cluster, you might lose 15-20% of resources to Kubernetes itself.
- **Learning curve**: It'll take weeks to be productive and months to be proficient.
- **Operational burden**: Unless you use a managed service (EKS, GKE), you're maintaining the control plane too.

**Use Kubernetes when:**
- You have multiple services that need to scale independently
- You need self-healing (auto-restart, auto-rescheduling)
- You deploy frequently and need zero-downtime updates
- You need multi-team/multi-environment isolation
- You're already on cloud infrastructure

**Don't use Kubernetes when:**
- You have 1-3 services on 1-2 servers (use Docker Compose)
- You're a solo developer or tiny team (use a PaaS like Railway, Fly.io, or Cloud Run)
- Your workload is purely serverless (use Lambda/Cloud Functions)
- You don't have time to learn it properly (a misconfigured cluster is worse than no cluster)

---

## Hands-On: Setting Up kind

`kind` (Kubernetes IN Docker) runs a full Kubernetes cluster inside Docker containers on your laptop. Each "node" is a Docker container running the Kubernetes components.

### Install kind

```bash
brew install kind kubectl
```

### Create a cluster

```bash
kind create cluster --name learn-k8s
```

This creates a single-node cluster. kind downloads the Kubernetes node image, starts it as a Docker container, and configures kubectl to talk to it.

### Verify it works

```bash
kubectl cluster-info --context kind-learn-k8s

kubectl get nodes

kubectl get namespaces

kubectl get pods -A
```

You should see one node in `Ready` state and system Pods running in `kube-system` namespace.

### Your first deployment

```bash
kubectl create deployment hello --image=nginx:1.25

kubectl get pods

kubectl get deployments

kubectl expose deployment hello --port=80 --type=ClusterIP

kubectl port-forward svc/hello 8080:80
```

Open `http://localhost:8080` in your browser. You just deployed and exposed an app on Kubernetes.

### Clean up

```bash
kubectl delete deployment hello
kubectl delete service hello
```

### Delete the cluster when done

```bash
kind delete cluster --name learn-k8s
```

---

## What Would Happen If...

**...you deleted the Pod that `kubectl create deployment` created?**

Try it:

```bash
kubectl create deployment test --image=nginx
kubectl get pods
kubectl delete pod <pod-name>
kubectl get pods
```

A new Pod appears. The Deployment's reconciliation loop saw that desired=1 but actual=0, so it created a replacement. This is self-healing in action.

**...you pulled the network cable on one of your servers?**

The kubelet on that node stops sending heartbeats to the API server. After a timeout (default 5 minutes), the node is marked `NotReady`. The controller manager reschedules all Pods from that node onto healthy nodes. Like the airline rebooking passengers when a gate closes.

**...the API server crashed?**

Existing workloads keep running. kubelet on each node continues managing its Pods. But you can't deploy anything new, scale anything, or get information from the cluster until the API server comes back. That's why production clusters run multiple API server replicas.

---

## Exercises

1. **Create a multi-node cluster** with kind. Create a config file that specifies 1 control-plane node and 2 worker nodes. Deploy nginx and see which node it lands on.

```yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
  - role: control-plane
  - role: worker
  - role: worker
```

```bash
kind create cluster --name multi-node --config kind-multi-node.yaml
kubectl get nodes
kubectl create deployment nginx --image=nginx --replicas=3
kubectl get pods -o wide
```

2. **Kill a Pod and watch it come back.** Deploy nginx with 3 replicas. Delete one Pod. Use `kubectl get pods -w` to watch the replacement appear in real-time.

3. **Compare docker-compose and Kubernetes.** Take a docker-compose file from one of your existing Go/TypeScript projects. Identify what each section maps to in Kubernetes (services → Deployments + Services, volumes → PVCs, environment → ConfigMaps).

4. **Break things.** Deploy something, then drain a worker node (`kubectl drain <node-name> --ignore-daemonsets`). Watch Pods get rescheduled to the remaining node. This simulates a server going down for maintenance.

---

## Key Takeaways

- Kubernetes solves the "many containers, many servers" problem
- You declare what you want (desired state), Kubernetes makes it happen
- The reconciliation loop constantly corrects drift between desired and actual state
- Self-healing means crashed Pods get replaced, dead nodes get drained
- It's not worth the complexity for simple deployments — use it when you actually need it
- Everything in Kubernetes is an API resource described in YAML

Next up: how the machine actually works — the architecture of Kubernetes.
